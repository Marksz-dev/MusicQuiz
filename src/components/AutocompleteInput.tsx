import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, Music, Check, Youtube } from 'lucide-react';
import { Track } from '../types/game';
import { searchTracks, isYouTubeGenre } from '../services/itunes';

export interface AutocompleteInputProps {
  onSelectTrack: (track: Track) => void;
  onSubmitGuess?: (guessText: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  genreId?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  onSelectTrack,
  onSubmitGuess,
  disabled = false,
  placeholder,
  autoFocus = false,
  genreId,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isYt = isYouTubeGenre(genreId);
  const defaultPlaceholder = isYt
    ? 'Search YouTube for anime / video game song or artist...'
    : 'Search by song title or artist...';
  const effectivePlaceholder = placeholder || defaultPlaceholder;

  // Debounced search (YouTube API for Anime/Games, iTunes API for others)
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    const handler = setTimeout(async () => {
      try {
        const data = await searchTracks(query, 10, genreId);
        setResults(data);
        setIsOpen(data.length > 0);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Error querying search API:', err);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(handler);
  }, [query, genreId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (track: Track) => {
    onSelectTrack(track);
    setQuery(`${track.title} - ${track.artist}`);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && results.length > 0) {
        setIsOpen(true);
        setSelectedIndex(0);
      } else {
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else if (query.trim()) {
        if (onSubmitGuess) {
          onSubmitGuess(query.trim());
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && onSubmitGuess && !disabled) {
      onSubmitGuess(query.trim());
      setQuery('');
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <form onSubmit={handleFormSubmit} className="relative flex items-center w-full">
        <div className="absolute left-3 sm:left-3.5 pointer-events-none text-zinc-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-rose-400" />
          ) : (
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </div>

        <input
          ref={inputRef}
          id="autocomplete-song-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          disabled={disabled}
          placeholder={disabled ? 'Round ended or already solved' : effectivePlaceholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className="w-full pl-9 sm:pl-11 pr-20 sm:pr-24 py-2.5 sm:py-3.5 bg-zinc-900 border border-zinc-700 focus:border-rose-500 rounded-xl text-white placeholder-zinc-500 text-xs sm:text-sm md:text-base shadow-inner focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {query && !disabled && (
          <button
            type="button"
            id="autocomplete-clear-btn"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-12 sm:right-14 text-zinc-400 hover:text-white p-1 transition-colors"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}

        <button
          type="submit"
          id="autocomplete-submit-btn"
          disabled={disabled || !query.trim()}
          className="absolute right-1.5 sm:right-2 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 hover:to-orange-300 disabled:from-zinc-800 disabled:to-zinc-800 text-white font-black rounded-lg text-xs shadow-md active:scale-95 transition-all disabled:text-zinc-600 disabled:cursor-not-allowed cursor-pointer"
        >
          Guess
        </button>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <ul
          id="autocomplete-results-dropdown"
          className="absolute z-50 left-0 right-0 mt-2 max-h-72 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl backdrop-blur-md divide-y divide-zinc-700/60"
        >
          {results.map((track, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <li
                key={`${track.id}-${idx}`}
                id={`autocomplete-item-${idx}`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  handleSelect(track);
                  if (onSubmitGuess) {
                    onSubmitGuess(`${track.title} - ${track.artist}`);
                    setQuery('');
                  }
                }}
                className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-zinc-700 text-rose-300' : 'text-zinc-200 hover:bg-zinc-700/60'
                }`}
              >
                {/* Artwork / Icon */}
                {track.artworkUrl ? (
                  <img
                    src={track.artworkUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-zinc-900 border border-zinc-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-zinc-900 flex items-center justify-center text-zinc-500 flex-shrink-0 border border-zinc-700">
                    <Music className="w-5 h-5" />
                  </div>
                )}

                {/* Track Details */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold truncate text-white">{track.title}</div>
                  <div className="text-xs text-zinc-400 truncate">
                    {track.artist} {track.releaseDate ? `• ${track.releaseDate}` : ''}
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
