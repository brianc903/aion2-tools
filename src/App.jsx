import { useState, useEffect } from 'react'
import './App.css'

const STORAGE_KEY = 'aion2_saved_usernames'

function App() {
  const [username, setUsername] = useState('')
  const [server, setServer] = useState('露梅')
  const [characterList, setCharacterList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [characterDataList, setCharacterDataList] = useState([])
  const [savedUsernames, setSavedUsernames] = useState([])

  // Load saved usernames from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setSavedUsernames(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse saved usernames:', e)
      }
    }
  }, [])

  // Save username to localStorage
  const saveUsername = (name, srv) => {
    const newEntry = { username: name, server: srv }
    const existing = savedUsernames.filter(
      item => !(item.username === name && item.server === srv)
    )
    const updated = [newEntry, ...existing].slice(0, 10) // Keep only last 10
    setSavedUsernames(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // Save multiple usernames at once
  const saveMultipleUsernames = (characters) => {
    const newEntries = characters.map(char => ({ username: char.username, server: char.server }))
    
    // Remove duplicates from existing list
    let existing = [...savedUsernames]
    newEntries.forEach(newEntry => {
      existing = existing.filter(
        item => !(item.username === newEntry.username && item.server === newEntry.server)
      )
    })
    
    // Add new entries at the beginning
    const updated = [...newEntries, ...existing].slice(0, 10) // Keep only last 10
    setSavedUsernames(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // Remove username from saved list
  const removeUsername = (name, srv) => {
    const updated = savedUsernames.filter(
      item => !(item.username === name && item.server === srv)
    )
    setSavedUsernames(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // Load username from saved list
  const loadUsername = (name, srv) => {
    setUsername(name)
    setServer(srv)
  }

  // Clear all saved usernames
  const clearAllUsernames = () => {
    setSavedUsernames([])
    localStorage.removeItem(STORAGE_KEY)
  }

  // Search all saved usernames
  const searchSavedUsernames = async () => {
    if (savedUsernames.length === 0) {
      setError('No saved usernames to search')
      return
    }

    setLoading(true)
    setError(null)
    setCharacterDataList([])
    setCharacterList(savedUsernames)

    try {
      // Fetch all characters in parallel
      const promises = savedUsernames.map(char => 
        fetchSingleCharacter(char.username, char.server)
          .catch(err => ({ error: err.message, searchedName: char.username, searchedServer: char.server }))
      )

      const results = await Promise.all(promises)
      setCharacterDataList(results)
      
    } catch (err) {
      setError(err.message || 'Failed to fetch character data')
      console.error('Error fetching characters:', err)
    } finally {
      setLoading(false)
    }
  }

  // Add character to search list
  const addCharacter = () => {
    if (!username.trim()) {
      setError('Please enter a username')
      return
    }

    // Check if character already exists in list
    const exists = characterList.some(
      char => char.username === username && char.server === server
    )

    if (exists) {
      setError('Character already in the list')
      return
    }

    setCharacterList([...characterList, { username, server }])
    setUsername('')
    setError(null)
  }

  // Remove character from search list
  const removeFromList = (index) => {
    setCharacterList(characterList.filter((_, i) => i !== index))
  }

  // Clear character list
  const clearCharacterList = () => {
    setCharacterList([])
    setCharacterDataList([])
  }

  // Search for a single character
  const fetchSingleCharacter = async (name, srv) => {
    const encodedName = encodeURIComponent(name)
    const encodedServer = encodeURIComponent(srv)
    const url = `https://aion-api.bnshive.com/character/query?name=${encodedName}&server=${encodedServer}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Check if character was found
    if (!data.queryResult || !data.queryResult.data) {
      throw new Error('Character not found')
    }

    return { ...data, searchedName: name, searchedServer: srv }
  }

  // Search all characters in the list
  const searchCharacters = async () => {
    if (characterList.length === 0) {
      setError('Please add at least one character to search')
      return
    }

    setLoading(true)
    setError(null)
    setCharacterDataList([])

    try {
      // Fetch all characters in parallel
      const promises = characterList.map(char => 
        fetchSingleCharacter(char.username, char.server)
          .catch(err => ({ error: err.message, searchedName: char.username, searchedServer: char.server }))
      )

      const results = await Promise.all(promises)
      setCharacterDataList(results)
      
      // Save all usernames to history
      saveMultipleUsernames(characterList)
      
    } catch (err) {
      setError(err.message || 'Failed to fetch character data')
      console.error('Error fetching characters:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    addCharacter()
  }

  const handleSearch = (e) => {
    e.preventDefault()
    searchCharacters()
  }

  // Extract character details from a single character data
  const extractCharacterDetails = (characterData) => {
    if (!characterData || characterData.error) {
      return {
        name: characterData?.searchedName || 'Unknown',
        server: characterData?.searchedServer || 'Unknown',
        error: characterData?.error || 'Failed to load',
        level: 'N/A',
        className: 'N/A',
        itemLevel: 'N/A',
        pveScore: 'N/A'
      }
    }

    if (!characterData.queryResult || !characterData.queryResult.data) {
      return {
        name: characterData.searchedName || 'Unknown',
        server: characterData.searchedServer || 'Unknown',
        error: 'Character not found',
        level: 'N/A',
        className: 'N/A',
        itemLevel: 'N/A',
        pveScore: 'N/A'
      }
    }

    const data = characterData.queryResult.data
    
    // Get PVE Score
    const pveScore = characterData.ratings?.PVE?.score || 'N/A'
    
    // Get Item Level
    let itemLevel = 'N/A'
    if (data.stat && data.stat.statList) {
      const itemLevelStat = data.stat.statList.find(stat => stat.type === 'ItemLevel')
      if (itemLevelStat) {
        itemLevel = itemLevelStat.value
      }
    }
    
    // Get Class Name
    const className = data.profile?.className || 'N/A'
    
    // Get Character Name
    const characterName = data.profile?.name || characterData.searchedName
    
    // Get Level
    const level = data.profile?.level || 'N/A'

    return {
      name: characterName,
      level,
      className,
      itemLevel,
      pveScore,
      server: characterData.searchedServer
    }
  }

  return (
    <div className="app">
      <h1>🎮 Aion2 Character Search</h1>

      {savedUsernames.length > 0 && (
        <div className="saved-usernames">
          <h3>📋 Saved Searches:</h3>
          <div className="username-pills">
            {savedUsernames.map((item, index) => (
              <div 
                key={index} 
                className="username-pill"
                onClick={() => loadUsername(item.username, item.server)}
              >
                <span>{item.username} ({item.server})</span>
                <button 
                  className="remove-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeUsername(item.username, item.server)
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="button-group" style={{ marginTop: '8px' }}>
            <button 
              onClick={searchSavedUsernames}
              disabled={loading}
            >
              {loading ? 'Searching...' : '🔍 Search All Saved'}
            </button>
            <button 
              className="secondary" 
              onClick={clearAllUsernames}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      <div className="search-section">
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <div className="input-field">
              <label htmlFor="username">Character Name</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter character name"
                disabled={loading}
              />
            </div>
            <div className="input-field">
              <label htmlFor="server">Server</label>
              <input
                id="server"
                type="text"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="Enter server name"
                disabled={loading}
              />
            </div>
          </div>
          <div className="button-group">
            <button type="submit" disabled={loading}>
              ➕ Add Character
            </button>
          </div>
        </form>

        {characterList.length > 0 && (
          <div className="character-queue">
            <h3>📝 Characters to Search ({characterList.length}):</h3>
            <div className="queue-list">
              {characterList.map((char, index) => (
                <div key={index} className="queue-item">
                  <span className="queue-name">{char.username}</span>
                  <span className="queue-server">({char.server})</span>
                  <button 
                    className="remove-btn"
                    onClick={() => removeFromList(index)}
                    title="Remove"
                    disabled={loading}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="button-group" style={{ marginTop: '10px' }}>
              <button onClick={handleSearch} disabled={loading}>
                {loading ? 'Searching...' : '🔍 Search All Characters'}
              </button>
              <button 
                className="secondary" 
                onClick={clearCharacterList}
                disabled={loading}
              >
                Clear List
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && <div className="loading">Loading character data...</div>}

      {error && <div className="error">❌ Error: {error}</div>}

      {characterDataList.length > 0 && (
        <div className="results-section">
          <h2 style={{ marginBottom: '10px', color: '#333', fontSize: '1rem' }}>
            📊 Results ({characterDataList.length} character{characterDataList.length > 1 ? 's' : ''})
          </h2>
          {characterDataList.map((charData, index) => {
            const details = extractCharacterDetails(charData)
            return (
              <div key={index} className={`character-card ${details.error ? 'error-card' : ''}`}>
                <h2>
                  {details.name}
                  <span className="server-badge">{details.server}</span>
                </h2>
                {details.error ? (
                  <div className="error" style={{ margin: '10px 0' }}>
                    ⚠️ {details.error}
                  </div>
                ) : (
                  <div className="character-details">
                    <div className="detail-item">
                      <div className="detail-label">Class</div>
                      <div className="detail-value">{details.className}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Item Level</div>
                      <div className="detail-value">{details.itemLevel}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">PVE Score</div>
                      <div className="detail-value">{details.pveScore}</div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default App
