import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'
const YOUTUBE_EMBED_BASE = 'https://www.youtube.com/embed'
const API_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN

const TABS = [
  { id: 'trending', label: 'Trending' },
  { id: 'popular', label: 'Popular' },
  { id: 'top', label: 'Top rated' },
  { id: 'upcoming', label: 'Upcoming' },
]

const TAB_ENDPOINTS = {
  trending: '/trending/movie/day',
  popular: '/movie/popular',
  top: '/movie/top_rated',
  upcoming: '/movie/upcoming',
}

function getPosterPath(path, size = 'w342') {
  return path ? `${IMAGE_BASE}/${size}${path}` : ''
}

function getBackdropPath(path) {
  return path ? `${IMAGE_BASE}/w1280${path}` : ''
}

function getProviderLogo(path, size = 'w92') {
  return path ? `${IMAGE_BASE}/${size}${path}` : ''
}

function getYear(date) {
  return date ? date.slice(0, 4) : 'TBA'
}

const PROVIDER_TYPES = [
  { id: 'free', label: 'Free' },
  { id: 'ads', label: 'With ads' },
  { id: 'flatrate', label: 'Subscription' },
  { id: 'rent', label: 'Rent' },
  { id: 'buy', label: 'Buy' },
]

const WATCH_REGION = 'US'

function collectProviders(providers) {
  if (!providers || typeof providers !== 'object') return []

  return PROVIDER_TYPES.flatMap(({ id, label }) => {
    const entries = Array.isArray(providers[id]) ? providers[id] : []

    return entries
      .filter((provider) => provider && provider.provider_name)
      .map((provider) => ({ ...provider, typeLabel: label }))
      .sort((a, b) => (a.display_priority || 99) - (b.display_priority || 99))
  })
}

function pickTrailer(videos) {
  const youtube = (Array.isArray(videos) ? videos : []).filter(
    (video) => video.site === 'YouTube' && video.key,
  )

  return (
    youtube.find((video) => video.type === 'Trailer' && video.official) ||
    youtube.find((video) => video.type === 'Trailer') ||
    youtube.find((video) => video.type === 'Teaser') ||
    youtube[0] ||
    null
  )
}

function formatRuntime(minutes) {
  if (!minutes) return 'Runtime unknown'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours ? `${hours}h ` : ''}${remainder ? `${remainder}m` : ''}`.trim()
}

function MovieArtwork({ path, alt, className = '' }) {
  return (
    <div className={`movie-artwork ${className}`.trim()}>
      {path ? (
        <img
          src={path}
          alt={alt}
          loading="lazy"
          onError={(event) => event.currentTarget.classList.add('is-hidden')}
        />
      ) : null}
      <span className="poster-fallback" aria-hidden="true">
        MK
      </span>
    </div>
  )
}

function MovieCard({ movie, onSelect }) {
  const title = movie.title || movie.name || 'Untitled movie'
  const poster = getPosterPath(movie.poster_path)

  return (
    <article className="movie-card">
      <button className="movie-card__button" type="button" onClick={() => onSelect(movie)}>
        <MovieArtwork path={poster} alt="" className="movie-card__artwork" />
        <span className="movie-card__content">
          <span className="movie-card__title">{title}</span>
          <span className="movie-card__meta">
            <span>{getYear(movie.release_date)}</span>
            <span className="movie-card__rating">★ {Number(movie.vote_average || 0).toFixed(1)}</span>
          </span>
        </span>
      </button>
    </article>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('trending')
  const [movies, setMovies] = useState([])
  const [featuredMovie, setFeaturedMovie] = useState(null)
  const [query, setQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [details, setDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [trailer, setTrailer] = useState(null)
  const [trailerLoading, setTrailerLoading] = useState(false)
  const [trailerError, setTrailerError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [providers, setProviders] = useState([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const moviesControllerRef = useRef(null)
  const detailsControllerRef = useRef(null)
  const trailerControllerRef = useRef(null)
  const providersControllerRef = useRef(null)
  const closeDetailsRef = useRef(null)

  const requestMovies = useCallback(async (tab, search = '') => {
    if (!API_TOKEN) {
      throw new Error('Add your TMDB access token to VITE_TMDB_ACCESS_TOKEN.')
    }

    const params = new URLSearchParams({
      language: 'en-US',
    })
    const endpoint = search ? '/search/movie' : TAB_ENDPOINTS[tab]
    if (search) {
      params.set('query', search)
      params.set('include_adult', 'false')
    }
    const response = await fetch(`${API_BASE}${endpoint}?${params}`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? 'The TMDB access token is not valid.'
          : 'Movies could not be loaded right now.',
      )
    }

    return Array.isArray(data.results) ? data.results : []
  }, [])

  const resetMovies = useCallback(() => {
    setLoading(true)
    setError('')
    setMovies([])
    setFeaturedMovie(null)
  }, [])

  const runMoviesRequest = useCallback(
    (tab, search = '') => {
      const requestId = moviesControllerRef.current ? moviesControllerRef.current.requestId + 1 : 1
      moviesControllerRef.current?.controller.abort()

      const controller = new AbortController()
      moviesControllerRef.current = { controller, requestId }
      resetMovies()

      requestMovies(tab, search)
        .then((results) => {
          if (requestId !== moviesControllerRef.current?.requestId) return
          setMovies(results)
          if (!search) {
            setFeaturedMovie(results.find((movie) => movie.backdrop_path) || results[0] || null)
          }
        })
        .catch((requestError) => {
          if (
            requestError.name === 'AbortError' ||
            requestId !== moviesControllerRef.current?.requestId
          ) {
            return
          }
          setError(requestError.message || 'Movies could not be loaded right now.')
        })
        .finally(() => {
          if (requestId === moviesControllerRef.current?.requestId) {
            setLoading(false)
          }
        })
    },
    [requestMovies, resetMovies],
  )

  useEffect(() => {
    let active = true
    const requestId = moviesControllerRef.current ? moviesControllerRef.current.requestId + 1 : 1
    const controller = new AbortController()
    moviesControllerRef.current = { controller, requestId }

    requestMovies(activeTab)
      .then((results) => {
        if (!active || requestId !== moviesControllerRef.current?.requestId) return
        setMovies(results)
        setFeaturedMovie(results.find((movie) => movie.backdrop_path) || results[0] || null)
      })
      .catch((requestError) => {
        if (!active || requestId !== moviesControllerRef.current?.requestId) return
        setError(requestError.message || 'Movies could not be loaded right now.')
      })
      .finally(() => {
        if (active && requestId === moviesControllerRef.current?.requestId) {
          setLoading(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [activeTab, requestMovies])

  useEffect(() => {
    if (!selectedMovie) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeDetailsRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedMovie])

  const requestTrailer = useCallback(async (movieId, signal) => {
    if (!API_TOKEN) {
      throw new Error('Add your TMDB access token to VITE_TMDB_ACCESS_TOKEN.')
    }

    const params = new URLSearchParams({ language: 'en-US' })
    const response = await fetch(`${API_BASE}/movie/${movieId}/videos?${params}`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      signal,
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error('The trailer could not be loaded right now.')
    }

    return pickTrailer(data.results)
  }, [])

  const requestProviders = useCallback(async (movieId, signal) => {
    if (!API_TOKEN) {
      throw new Error('Add your TMDB access token to VITE_TMDB_ACCESS_TOKEN.')
    }

    const params = new URLSearchParams({ language: 'en-US' })
    const response = await fetch(`${API_BASE}/movie/${movieId}/watch/providers?${params}`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      signal,
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error('Streaming options could not be loaded right now.')
    }

    return collectProviders(data.results?.[WATCH_REGION])
  }, [])

  const openDetails = useCallback(
    async (movie) => {
      const requestId = detailsControllerRef.current
        ? detailsControllerRef.current.requestId + 1
        : 1
      const trailerRequestId = trailerControllerRef.current
        ? trailerControllerRef.current.requestId + 1
        : 1
      const providersRequestId = providersControllerRef.current
        ? providersControllerRef.current.requestId + 1
        : 1
      detailsControllerRef.current?.controller.abort()
      trailerControllerRef.current?.controller.abort()
      providersControllerRef.current?.controller.abort()

      const controller = new AbortController()
      const trailerController = new AbortController()
      const providersController = new AbortController()
      detailsControllerRef.current = { controller, requestId }
      trailerControllerRef.current = { controller: trailerController, requestId: trailerRequestId }
      providersControllerRef.current = {
        controller: providersController,
        requestId: providersRequestId,
      }
      setSelectedMovie(movie)
      setDetails(null)
      setDetailsError('')
      setDetailsLoading(true)
      setTrailer(null)
      setTrailerError('')
      setIsPlaying(false)
      setTrailerLoading(true)
      setProviders([])
      setProvidersLoading(true)

      requestProviders(movie.id, providersController.signal)
        .then((results) => {
          if (providersRequestId !== providersControllerRef.current?.requestId) return
          setProviders(results)
        })
        .catch(() => {
          if (providersRequestId !== providersControllerRef.current?.requestId) return
          setProviders([])
        })
        .finally(() => {
          if (providersRequestId === providersControllerRef.current?.requestId) {
            setProvidersLoading(false)
          }
        })

      requestTrailer(movie.id, trailerController.signal)
        .then((video) => {
          if (trailerRequestId !== trailerControllerRef.current?.requestId) return
          setTrailer(video)
        })
        .catch((requestError) => {
          if (
            requestError.name === 'AbortError' ||
            trailerRequestId !== trailerControllerRef.current?.requestId
          ) {
            return
          }
          setTrailerError(requestError.message || 'The trailer could not be loaded right now.')
        })
        .finally(() => {
          if (trailerRequestId === trailerControllerRef.current?.requestId) {
            setTrailerLoading(false)
          }
        })

      try {
        if (!API_TOKEN) {
          throw new Error('Add your TMDB access token to VITE_TMDB_ACCESS_TOKEN.')
        }

        const params = new URLSearchParams({ language: 'en-US' })
        const response = await fetch(`${API_BASE}/movie/${movie.id}?${params}`, {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
          },
          signal: controller.signal,
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error('Movie details could not be loaded right now.')
        }

        if (requestId === detailsControllerRef.current?.requestId) {
          setDetails(data)
        }
      } catch (requestError) {
        if (
          requestError.name === 'AbortError' ||
          requestId !== detailsControllerRef.current?.requestId
        ) {
          return
        }
        setDetailsError(requestError.message || 'Movie details could not be loaded right now.')
      } finally {
        if (requestId === detailsControllerRef.current?.requestId) {
          setDetailsLoading(false)
        }
      }
    },
    [requestTrailer, requestProviders],
  )

  const closeDetails = useCallback(() => {
    detailsControllerRef.current?.controller.abort()
    trailerControllerRef.current?.controller.abort()
    providersControllerRef.current?.controller.abort()
    setSelectedMovie(null)
    setDetails(null)
    setDetailsError('')
    setDetailsLoading(false)
    setTrailer(null)
    setTrailerError('')
    setTrailerLoading(false)
    setIsPlaying(false)
    setProviders([])
    setProvidersLoading(false)
  }, [])

  const handleSearch = (event) => {
    event.preventDefault()
    const nextQuery = query.trim()
    setSearchQuery(nextQuery)
    runMoviesRequest(activeTab, nextQuery)
  }

  const clearSearch = () => {
    setQuery('')
    setSearchQuery('')
    runMoviesRequest(activeTab)
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setQuery('')
    setSearchQuery('')
  }

  const handleModalKeyDown = (event) => {
    if (event.key === 'Escape') closeDetails()
  }

  const activeTabLabel = TABS.find((tab) => tab.id === activeTab)?.label || 'Movies'
  const sectionTitle = searchQuery ? `Results for “${searchQuery}”` : activeTabLabel
  const watchLink = providers.find((provider) => provider.free || provider.ads)?.link || ''
  const trailerEmbedUrl = trailer
    ? `${YOUTUBE_EMBED_BASE}/${trailer.key}?autoplay=1&rel=0&modestbranding=1`
    : ''
  const backdrop = featuredMovie ? getBackdropPath(featuredMovie.backdrop_path) : ''
  const featuredTitle = featuredMovie?.title || featuredMovie?.name || ''

  return (
    <div className="app-shell" onKeyDown={handleModalKeyDown}>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="#top" aria-label="Movie King home">
            <span className="brand__mark" aria-hidden="true">
              MK
            </span>
            <span>
              <strong>Movie</strong> King
            </span>
          </a>

          <form className="search-form" role="search" onSubmit={handleSearch}>
            <label className="sr-only" htmlFor="movie-search">
              Search movies
            </label>
            <input
              id="movie-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search movies..."
              autoComplete="off"
            />
            {query ? (
              <button className="search-form__clear" type="button" onClick={clearSearch} aria-label="Clear search">
                ×
              </button>
            ) : null}
            <button className="search-form__submit" type="submit" aria-label="Submit search">
              <span aria-hidden="true">⌕</span>
            </button>
          </form>
        </div>
      </header>

      <main id="top">
        {featuredMovie && !searchQuery ? (
          <section
            className={`hero ${backdrop ? 'hero--has-backdrop' : ''}`}
            style={
              backdrop
                ? {
                    backgroundImage: `linear-gradient(90deg, rgba(8, 10, 15, 0.96) 0%, rgba(8, 10, 15, 0.72) 45%, rgba(8, 10, 15, 0.2) 100%), linear-gradient(0deg, #0b0d12 0%, transparent 45%), url("${backdrop}")`,
                  }
                : undefined
            }
          >
            <div className="hero__content">
              <p className="eyebrow">Now showing</p>
              <h1>{featuredTitle}</h1>
              <div className="hero__meta">
                <span>{getYear(featuredMovie.release_date)}</span>
                <span>★ {Number(featuredMovie.vote_average || 0).toFixed(1)}</span>
                <span>{featuredMovie.original_language?.toUpperCase()}</span>
              </div>
              <p className="hero__overview">{featuredMovie.overview || 'A story waiting to be discovered.'}</p>
              <button className="button button--primary" type="button" onClick={() => openDetails(featuredMovie)}>
                View details
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        ) : null}

        <section className="catalog" aria-labelledby="catalog-heading">
          <div className="catalog__heading">
            <div>
              <p className="eyebrow">Discover</p>
              <h2 id="catalog-heading">{sectionTitle}</h2>
            </div>
            <nav className="category-nav" aria-label="Movie categories">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={activeTab === tab.id && !searchQuery ? 'is-active' : ''}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {error ? (
            <div className="state-panel" role="alert">
              <span className="state-panel__icon" aria-hidden="true">
                !
              </span>
              <h3>Something went wrong</h3>
              <p>{error}</p>
              <button className="button button--secondary" type="button" onClick={() => runMoviesRequest(activeTab, searchQuery)}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="movie-grid" aria-label="Loading movies">
              {Array.from({ length: 8 }, (_, index) => (
                <div className="skeleton-card" key={index} aria-hidden="true">
                  <div className="skeleton skeleton--poster" />
                  <div className="skeleton skeleton--line" />
                  <div className="skeleton skeleton--line-short" />
                </div>
              ))}
            </div>
          ) : movies.length ? (
            <div className="movie-grid">
              {movies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} onSelect={openDetails} />
              ))}
            </div>
          ) : (
            <div className="state-panel">
              <span className="state-panel__icon" aria-hidden="true">
                ⌕
              </span>
              <h3>No movies found</h3>
              <p>Try another title or browse a different category.</p>
              <button className="button button--secondary" type="button" onClick={clearSearch}>
                Browse trending
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <span>Movie King</span>
        <span>Find your next favorite story.</span>
      </footer>

      {selectedMovie ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeDetails}>
          <section
            className="movie-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="movie-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              ref={closeDetailsRef}
              className="modal-close"
              type="button"
              onClick={closeDetails}
              aria-label="Close movie details"
            >
              ×
            </button>
            {details?.backdrop_path ? (
              <div
                className="movie-modal__backdrop"
                style={{ backgroundImage: `url("${getBackdropPath(details.backdrop_path)}")` }}
              />
            ) : null}
            <div className="movie-modal__content">
              <div className="movie-modal__poster">
                <MovieArtwork path={getPosterPath(details?.poster_path)} alt="" />
              </div>
              <div className="movie-modal__body">
                {detailsLoading ? (
                  <div className="details-loading" role="status">
                    <span className="spinner" aria-hidden="true" />
                    <p>Loading movie details...</p>
                  </div>
                ) : detailsError ? (
                  <div className="details-error" role="alert">
                    <h2 id="movie-modal-title">{selectedMovie.title || 'Movie details'}</h2>
                    <p>{detailsError}</p>
                  </div>
                ) : details ? (
                  <>
                    <p className="eyebrow">Movie details</p>
                    <h2 id="movie-modal-title">{details.title}</h2>
                    <div className="movie-modal__meta">
                      <span>{getYear(details.release_date)}</span>
                      <span>★ {Number(details.vote_average || 0).toFixed(1)}</span>
                      <span>{formatRuntime(details.runtime)}</span>
                    </div>
                    {details.genres?.length ? (
                      <div className="genre-list" aria-label="Genres">
                        {details.genres.map((genre) => (
                          <span key={genre.id}>{genre.name}</span>
                        ))}
                      </div>
                    ) : null}
                    <p className="movie-modal__overview">{details.overview || 'No overview is available.'}</p>
                    {trailerLoading ? (
                      <div className="trailer" role="status">
                        <span className="trailer__frame trailer__frame--loading">
                          <span className="spinner" aria-hidden="true" />
                        </span>
                        <p className="trailer__status">Looking for a trailer...</p>
                      </div>
                    ) : trailerError ? (
                      <div className="trailer" role="alert">
                        <span className="trailer__frame trailer__frame--empty" aria-hidden="true">
                          <span className="trailer__play-icon">▶</span>
                        </span>
                        <p className="trailer__status trailer__status--error">{trailerError}</p>
                      </div>
                    ) : trailer ? (
                      <div className="trailer">
                        {isPlaying ? (
                          <span className="trailer__frame">
                            <iframe
                              className="trailer__iframe"
                              src={trailerEmbedUrl}
                              title={`${details.title} trailer`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </span>
                        ) : (
                          <button
                            className="trailer__frame trailer__frame--poster"
                            type="button"
                            onClick={() => setIsPlaying(true)}
                            style={
                              details.backdrop_path
                                ? {
                                    backgroundImage: `linear-gradient(0deg, rgba(8, 10, 15, 0.82) 0%, rgba(8, 10, 15, 0.2) 100%), url("${getBackdropPath(details.backdrop_path)}")`,
                                  }
                                : undefined
                            }
                            aria-label={`Play the trailer for ${details.title}`}
                          >
                            <span className="trailer__play-icon" aria-hidden="true">
                              ▶
                            </span>
                            <span className="trailer__label">
                              {trailer.type === 'Teaser' ? 'Play teaser' : 'Play trailer'}
                            </span>
                          </button>
                        )}
                      </div>
                    ) : null}
                    <div className="watch">
                      {providersLoading ? (
                        <p className="watch__status" role="status">
                          Checking streaming availability...
                        </p>
                      ) : providers.length ? (
                        <>
                          <p className="watch__heading">Where to watch</p>
                          <div className="watch__list">
                            {providers.map((provider) => (
                              <a
                                key={`${provider.provider_id}-${provider.typeLabel}`}
                                className="watch__provider"
                                href={provider.link || '#watch-providers'}
                                target="_blank"
                                rel="noreferrer noopener"
                              >
                                <span className="watch__logo">
                                  {provider.logo_path ? (
                                    <img
                                      src={getProviderLogo(provider.logo_path)}
                                      alt=""
                                      loading="lazy"
                                    />
                                  ) : (
                                    <span aria-hidden="true">{provider.provider_name.slice(0, 2)}</span>
                                  )}
                                </span>
                                <span className="watch__meta">
                                  <strong>{provider.provider_name}</strong>
                                  <span>{provider.typeLabel}</span>
                                </span>
                                <span className="watch__arrow" aria-hidden="true">
                                  ↗
                                </span>
                              </a>
                            ))}
                          </div>
                          <p className="watch__note">
                            Availability shown for the United States, powered by JustWatch.
                            Subscriptions and rentals are billed by the provider.
                          </p>
                        </>
                      ) : !providersLoading ? (
                        <p className="watch__status">
                          No streaming options are listed for this movie right now.
                        </p>
                      ) : null}
                      {watchLink ? (
                        <a
                          className="button button--primary watch__cta"
                          href={watchLink}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Watch full movie
                          <span aria-hidden="true">↗</span>
                        </a>
                      ) : null}
                    </div>
                    <div className="movie-modal__stats">
                      <div>
                        <span>Popularity</span>
                        <strong>{Math.round(details.popularity || 0).toLocaleString()}</strong>
                      </div>
                      <div>
                        <span>Vote count</span>
                        <strong>{Number(details.vote_count || 0).toLocaleString()}</strong>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
