import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'
const API_KEY = import.meta.env.VITE_TMDB_API_KEY

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

function getYear(date) {
  return date ? date.slice(0, 4) : 'TBA'
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
  const moviesControllerRef = useRef(null)
  const detailsControllerRef = useRef(null)
  const closeDetailsRef = useRef(null)

  const requestMovies = useCallback(async (tab, search = '') => {
    if (!API_KEY) {
      throw new Error('Add your TMDB API key to VITE_TMDB_API_KEY.')
    }

    const params = new URLSearchParams({
      api_key: API_KEY,
      language: 'en-US',
    })
    const endpoint = search ? '/search/movie' : TAB_ENDPOINTS[tab]
    if (search) {
      params.set('query', search)
      params.set('include_adult', 'false')
    }
    const response = await fetch(`${API_BASE}${endpoint}?${params}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? 'The movie API key is not valid.'
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

  const openDetails = useCallback(
    async (movie) => {
      const requestId = detailsControllerRef.current
        ? detailsControllerRef.current.requestId + 1
        : 1
      detailsControllerRef.current?.controller.abort()

      const controller = new AbortController()
      detailsControllerRef.current = { controller, requestId }
      setSelectedMovie(movie)
      setDetails(null)
      setDetailsError('')
      setDetailsLoading(true)

      try {
        if (!API_KEY) {
          throw new Error('Add your TMDB API key to VITE_TMDB_API_KEY.')
        }

        const params = new URLSearchParams({ api_key: API_KEY, language: 'en-US' })
        const response = await fetch(`${API_BASE}/movie/${movie.id}?${params}`, {
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
    [],
  )

  const closeDetails = useCallback(() => {
    detailsControllerRef.current?.controller.abort()
    setSelectedMovie(null)
    setDetails(null)
    setDetailsError('')
    setDetailsLoading(false)
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
