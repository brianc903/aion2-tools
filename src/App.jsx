import { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'

const STORAGE_KEY = 'aion2_saved_usernames'
const SUPPORT_CLASS = '治癒星'
const DEFAULT_TEAM_NAMES = ['Team 1', 'Team 2']
const SUBTEAM_LABELS = ['Subteam A', 'Subteam B']
const DEFAULT_TEAM_TIME = '20:00'

const padTwo = (num) => String(num).padStart(2, '0')

const toInputDate = (date) => `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`

const getUpcomingRaidWindow = () => {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  let diff = (3 - start.getDay() + 7) % 7
  if (diff === 0) {
    diff = 7
  }
  start.setDate(start.getDate() + diff)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  return {
    start,
    end,
    startInput: toInputDate(start),
    endInput: toInputDate(end)
  }
}

const formatDisplayDate = (value) => {
  if (!value) {
    return 'Date TBD'
  }
  const asDate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(asDate.getTime())) {
    return 'Date TBD'
  }
  return asDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const formatDisplayDateTime = (dateValue, timeValue) => {
  const datePart = formatDisplayDate(dateValue)
  const timePart = timeValue && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue) ? timeValue : '--:--'
  return `${datePart} • ${timePart}`
}

const toNumericScore = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '')
    const parsed = parseFloat(cleaned)
    return Number.isNaN(parsed) ? NaN : parsed
  }
  return NaN
}

const parseCharacterNames = (raw) => {
  if (!raw || !raw.trim()) {
    return []
  }

  const names = raw
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(Boolean)

  const unique = []
  const seen = new Set()

  names.forEach(name => {
    if (!seen.has(name)) {
      seen.add(name)
      unique.push(name)
    }
  })

  return unique
}

const uniqueId = (prefix = 'team') => {
  const safePrefix = prefix.toLowerCase().replace(/\s+/g, '-') || 'team'
  return `${safePrefix}-${Math.random().toString(36).slice(2, 7)}-${Date.now().toString(36)}`
}

const createSubteamTemplate = (teamBaseId, label, index) => {
  const subId = `${teamBaseId}-sub-${index + 1}`
  return {
    id: subId,
    name: label,
    slots: [
      { id: `${subId}-dps-1`, label: 'DPS 1', role: 'dps' },
      { id: `${subId}-dps-2`, label: 'DPS 2', role: 'dps' },
      { id: `${subId}-dps-3`, label: 'DPS 3', role: 'dps' },
      { id: `${subId}-support`, label: 'Support', role: 'support' }
    ]
  }
}

const createTeamTemplate = (label) => {
  const baseId = uniqueId(label)
  return {
    id: baseId,
    name: label,
    subteams: SUBTEAM_LABELS.map((subLabel, index) => createSubteamTemplate(baseId, subLabel, index))
  }
}

const createDefaultTeams = () => DEFAULT_TEAM_NAMES.map(name => createTeamTemplate(name))

const initializeTeamSchedules = (teamList, defaultDate) => {
  const map = {}
  teamList.forEach(team => {
    map[team.id] = defaultDate
  })
  return map
}

const initializeTeamTimes = (teamList, defaultTime) => {
  const map = {}
  teamList.forEach(team => {
    map[team.id] = defaultTime
  })
  return map
}

const buildAssignmentsFromTeams = (teamList) => {
  const slots = {}
  teamList.forEach(team => {
    team.subteams.forEach(subteam => {
      subteam.slots.forEach(slot => {
        slots[slot.id] = null
      })
    })
  })
  return slots
}

const toKeyPart = (value) => (value || '').toString().trim().toLowerCase()

const buildRosterKey = (entry) => {
  if (!entry) {
    return 'unknown::'
  }
  const name = entry.searchedName || entry.queryResult?.data?.profile?.name || entry.id || ''
  const server = entry.searchedServer || entry.queryResult?.data?.profile?.serverName || ''
  return `${toKeyPart(name)}::${toKeyPart(server)}`
}

const mergeCharacterResults = (existingList, newList) => {
  const map = new Map()
  existingList.forEach(entry => {
    map.set(buildRosterKey(entry), entry)
  })
  newList.forEach(entry => {
    if (!entry) {
      return
    }
    map.set(buildRosterKey(entry), entry)
  })
  return Array.from(map.values())
}

function App() {
  const weekWindow = useMemo(() => getUpcomingRaidWindow(), [])
  const [username, setUsername] = useState('')
  const [server, setServer] = useState('露梅')
  const [characterList, setCharacterList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [characterDataList, setCharacterDataList] = useState([])
  const [savedUsernames, setSavedUsernames] = useState([])
  const [activeTab, setActiveTab] = useState('search')
  const initialTeams = useMemo(() => createDefaultTeams(), [])
  const [teams, setTeams] = useState(initialTeams)
  const [teamSchedules, setTeamSchedules] = useState(() => initializeTeamSchedules(initialTeams, weekWindow.startInput))
  const [teamTimes, setTeamTimes] = useState(() => initializeTeamTimes(initialTeams, DEFAULT_TEAM_TIME))
  const [teamAssignments, setTeamAssignments] = useState(() => buildAssignmentsFromTeams(initialTeams))
  const [showPveScores, setShowPveScores] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const windowLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    return `${formatter.format(weekWindow.start)} → ${formatter.format(weekWindow.end)}`
  }, [weekWindow])
  const draggingMemberRef = useRef(null)
  const teamStats = useMemo(() => {
    const stats = {}
    teams.forEach(team => {
      stats[team.id] = {}
      team.subteams.forEach(subteam => {
        const dpsMembers = subteam.slots
          .filter(slot => slot.role === 'dps')
          .map(slot => teamAssignments[slot.id])
          .filter(member => {
            if (!member) {
              return false
            }
            return !Number.isNaN(toNumericScore(member.pveScore))
          })

        if (dpsMembers.length > 0) {
          const total = dpsMembers.reduce((sum, member) => sum + (toNumericScore(member.pveScore) || 0), 0)
          stats[team.id][subteam.id] = {
            count: dpsMembers.length,
            average: total / dpsMembers.length
          }
        } else {
          stats[team.id][subteam.id] = {
            count: 0,
            average: null
          }
        }
      })
    })
    return stats
  }, [teams, teamAssignments])

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
    const updated = [newEntry, ...existing].slice(0, 100)
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
    const updated = [...newEntries, ...existing].slice(0, 100)
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
    setCharacterList(savedUsernames)

    try {
      // Fetch all characters in parallel
      const promises = savedUsernames.map(char => 
        fetchSingleCharacter(char.username, char.server)
          .catch(err => ({ error: err.message, searchedName: char.username, searchedServer: char.server }))
      )

      const results = await Promise.all(promises)
      setCharacterDataList(prev => mergeCharacterResults(prev, results))
      
    } catch (err) {
      setError(err.message || 'Failed to fetch character data')
      console.error('Error fetching characters:', err)
    } finally {
      setLoading(false)
    }
  }

  // Add character to search list
  const addCharacter = () => {
    const names = parseCharacterNames(username)

    if (names.length === 0) {
      setError('Please enter at least one character name')
      return
    }

    const existingSet = new Set(
      characterList.map(char => `${char.username}::${char.server}`)
    )

    const newCharacters = names
      .filter(name => !existingSet.has(`${name}::${server}`))
      .map(name => ({ username: name, server }))

    if (newCharacters.length === 0) {
      setError('All characters are already in the list')
      return
    }

    setCharacterList(prev => [...prev, ...newCharacters])
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
    const apiUrl = `https://aion-api.bnshive.com/character/query?name=${encodedName}&server=${encodedServer}&refresh=true`

    const response = await fetch(apiUrl)

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

    try {
      // Fetch all characters in parallel
      const promises = characterList.map(char => 
        fetchSingleCharacter(char.username, char.server)
          .catch(err => ({ error: err.message, searchedName: char.username, searchedServer: char.server }))
      )

      const results = await Promise.all(promises)
      setCharacterDataList(prev => mergeCharacterResults(prev, results))
      
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

  const rosterMembers = useMemo(() => {
    const members = characterDataList
      .map(extractCharacterDetails)
      .filter(details => !details.error && details.className && details.className !== 'N/A')
      .map(details => ({
        id: `${details.name}-${details.server}`,
        name: details.name,
        server: details.server,
        className: details.className,
        pveScore: details.pveScore,
        role: details.className === SUPPORT_CLASS ? 'support' : 'dps'
      }))

    members.sort((a, b) => {
      const scoreA = toNumericScore(a.pveScore)
      const scoreB = toNumericScore(b.pveScore)
      const aInvalid = Number.isNaN(scoreA)
      const bInvalid = Number.isNaN(scoreB)
      if (aInvalid && bInvalid) return 0
      if (aInvalid) return 1
      if (bInvalid) return -1
      return scoreB - scoreA
    })

    return members
  }, [characterDataList])

  useEffect(() => {
    setTeamAssignments(prev => {
      let changed = false
      const updated = { ...prev }
      Object.entries(updated).forEach(([slotId, member]) => {
        if (member && !rosterMembers.some(rosterMember => rosterMember.id === member.id)) {
          updated[slotId] = null
          changed = true
        }
      })
      return changed ? updated : prev
    })
  }, [rosterMembers])

  const assignedIds = new Set(
    Object.values(teamAssignments)
      .filter(Boolean)
      .map(member => member.id)
  )

  const hasAssignments = assignedIds.size > 0

  const availableDps = rosterMembers.filter(member => member.role === 'dps' && !assignedIds.has(member.id))
  const availableSupport = rosterMembers.filter(member => member.role === 'support' && !assignedIds.has(member.id))

  const handleDragStart = (event, member) => {
    draggingMemberRef.current = member
    event.dataTransfer.setData('application/json', JSON.stringify({ member }))
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    draggingMemberRef.current = null
  }

  const handleDragOver = (event, slotRole) => {
    const member = draggingMemberRef.current
    if (!member || member.role !== slotRole) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (event, slotId, slotRole) => {
    const draggedMember = draggingMemberRef.current
    const payload = event.dataTransfer.getData('application/json')
    let parsedMember = draggedMember

    if (!parsedMember && payload) {
      try {
        const data = JSON.parse(payload)
        parsedMember = data.member
      } catch (e) {
        // Ignore malformed payloads
      }
    }

    if (!parsedMember || parsedMember.role !== slotRole) {
      return
    }

    event.preventDefault()

    const memberToAssign = parsedMember

    setTeamAssignments(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(key => {
        if (updated[key]?.id === memberToAssign.id) {
          updated[key] = null
        }
      })
      updated[slotId] = memberToAssign
      return updated
    })

    draggingMemberRef.current = null
  }

  const clampDateToWindow = (value) => {
    if (!value) {
      return ''
    }
    if (value < weekWindow.startInput) {
      return weekWindow.startInput
    }
    if (value > weekWindow.endInput) {
      return weekWindow.endInput
    }
    return value
  }

  const handleScheduleChange = (teamId, value) => {
    const nextValue = clampDateToWindow(value)
    setTeamSchedules(prev => ({
      ...prev,
      [teamId]: nextValue
    }))
  }

  const normalizeTimeValue = (value) => {
    if (!value) {
      return DEFAULT_TEAM_TIME
    }
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : DEFAULT_TEAM_TIME
  }

  const handleTimeChange = (teamId, value) => {
    const nextValue = normalizeTimeValue(value)
    setTeamTimes(prev => ({
      ...prev,
      [teamId]: nextValue
    }))
  }

  const handleRemoveFromSlot = (slotId) => {
    setTeamAssignments(prev => ({
      ...prev,
      [slotId]: null
    }))
  }

  const resetTeams = () => {
    setTeamAssignments(buildAssignmentsFromTeams(teams))
  }

  const handleMoveTeam = (teamId, direction) => {
    setTeams(prevTeams => {
      const currentIndex = prevTeams.findIndex(team => team.id === teamId)
      if (currentIndex === -1) {
        return prevTeams
      }
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (nextIndex < 0 || nextIndex >= prevTeams.length) {
        return prevTeams
      }
      const updated = [...prevTeams]
      const [movingTeam] = updated.splice(currentIndex, 1)
      updated.splice(nextIndex, 0, movingTeam)
      return updated
    })
  }

  const handleAddTeam = () => {
    setTeams(prevTeams => {
      const nextIndex = prevTeams.length
      const label = DEFAULT_TEAM_NAMES[nextIndex] || `Team ${nextIndex + 1}`
      const newTeam = createTeamTemplate(label)
      setTeamAssignments(prevAssignments => ({
        ...prevAssignments,
        ...buildAssignmentsFromTeams([newTeam])
      }))
      setTeamSchedules(prevSchedules => ({
        ...prevSchedules,
        [newTeam.id]: weekWindow.startInput
      }))
      setTeamTimes(prevTimes => ({
        ...prevTimes,
        [newTeam.id]: DEFAULT_TEAM_TIME
      }))
      return [...prevTeams, newTeam]
    })
  }

  const handleRemoveTeam = (teamId) => {
    if (teams.length <= 1) {
      return
    }

    const teamToRemove = teams.find(team => team.id === teamId)
    if (!teamToRemove) {
      return
    }

    setTeams(prev => prev.filter(team => team.id !== teamId))
    setTeamAssignments(prev => {
      const updated = { ...prev }
      teamToRemove.subteams.forEach(subteam => {
        subteam.slots.forEach(slot => {
          delete updated[slot.id]
        })
      })
      return updated
    })
    setTeamSchedules(prev => {
      const updated = { ...prev }
      delete updated[teamId]
      return updated
    })
    setTeamTimes(prev => {
      const updated = { ...prev }
      delete updated[teamId]
      return updated
    })
  }

  return (
    <div className="app">
      <h1>🎮 Aion2 Character Search</h1>

      <div className="tab-bar">
        <button
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          🔍 Search
        </button>
        <button
          className={`tab-button ${activeTab === 'dungeon' ? 'active' : ''}`}
          onClick={() => setActiveTab('dungeon')}
          disabled={characterDataList.length === 0}
        >
          🛡️ Dungeon Teams
        </button>
      </div>

      {activeTab === 'search' && (
        <>
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
                  <label htmlFor="username">Character Names</label>
                  <textarea
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter one character name per line"
                    disabled={loading}
                    rows={4}
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
        </>
      )}

      {activeTab === 'dungeon' && (
        <div className="team-section">
          <div className="team-section-header">
            <div>
              <h2>🛡️ Weekly Dungeon Planner</h2>
              <p className="team-hint">
                Drag characters into each slot. Every squad needs 3 DPS and 1 治癒星 support.
              </p>
              <p className="team-window-note">
                Upcoming window: {windowLabel} (Wed → Tue only)
              </p>
            </div>
            <div className="team-section-actions">
              <button
                className={showPveScores ? 'secondary' : ''}
                onClick={() => setShowPveScores(prev => !prev)}
              >
                {showPveScores ? 'Hide PVE Scores' : 'Show PVE Scores'}
              </button>
              <button className="secondary" onClick={() => setShowPreview(true)}>
                👀 Preview Layout
              </button>
              <button onClick={handleAddTeam}>
                ➕ Add Team
              </button>
              <button className="secondary" onClick={resetTeams} disabled={!hasAssignments}>
                Reset Teams
              </button>
            </div>
          </div>

          {rosterMembers.length === 0 ? (
            <div className="empty-roster">
              Run a search on the 🔍 tab to populate your roster before assigning teams.
            </div>
          ) : (
            <div className="team-layout">
              <div className="roster-panel">
                <div className="roster-group">
                  <div className="roster-group-header">
                    <h3>⚔️ DPS ({availableDps.length})</h3>
                    <span>Non-治癒星 classes</span>
                  </div>
                  <div className="roster-grid">
                    {availableDps.map(member => (
                      <div
                        key={member.id}
                        className="roster-card dps"
                        draggable
                        onDragStart={(event) => handleDragStart(event, member)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="roster-name">{member.name}</div>
                        <div className="roster-meta">
                          <span>{member.className}</span>
                          {showPveScores && <span>PVE {member.pveScore}</span>}
                        </div>
                      </div>
                    ))}
                    {availableDps.length === 0 && (
                      <div className="roster-empty">All DPS are already assigned.</div>
                    )}
                  </div>
                </div>

                <div className="roster-group">
                  <div className="roster-group-header">
                    <h3>💚 Support ({availableSupport.length})</h3>
                    <span>治癒星 only</span>
                  </div>
                  <div className="roster-grid">
                    {availableSupport.map(member => (
                      <div
                        key={member.id}
                        className="roster-card support"
                        draggable
                        onDragStart={(event) => handleDragStart(event, member)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="roster-name">{member.name}</div>
                        <div className="roster-meta">
                          <span>{member.className}</span>
                          {showPveScores && <span>PVE {member.pveScore}</span>}
                        </div>
                      </div>
                    ))}
                    {availableSupport.length === 0 && (
                      <div className="roster-empty">No free supports available.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="teams-panel">
                {teams.map((team, index) => (
                  <div key={team.id} className="team-card">
                    <div className="team-card-header">
                      <div className="team-card-title">
                        <h3>{team.name}</h3>
                        <div className="team-card-controls">
                          <div className="team-order-controls">
                            <button
                              className="team-order-btn"
                              onClick={() => handleMoveTeam(team.id, 'up')}
                              disabled={index === 0}
                              aria-label={`Move ${team.name} up`}
                            >
                              ↑
                            </button>
                            <button
                              className="team-order-btn"
                              onClick={() => handleMoveTeam(team.id, 'down')}
                              disabled={index === teams.length - 1}
                              aria-label={`Move ${team.name} down`}
                            >
                              ↓
                            </button>
                          </div>
                          {teams.length > 1 && (
                            <button
                              className="team-remove"
                              onClick={() => handleRemoveTeam(team.id)}
                              disabled={teams.length <= 1}
                              aria-label={`Remove ${team.name}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="team-card-meta">
                        <span>8 slots • 2 sub-teams</span>
                        <div className="team-date-time-row">
                          <label className="team-date-picker">
                            <span>Run date (Wed → Tue)</span>
                            <input
                              type="date"
                              value={teamSchedules[team.id] || ''}
                              min={weekWindow.startInput}
                              max={weekWindow.endInput}
                              onChange={(event) => handleScheduleChange(team.id, event.target.value)}
                            />
                          </label>
                          <label className="team-time-picker">
                            <span>Start time</span>
                            <input
                              type="time"
                              step="900"
                              value={teamTimes[team.id] || DEFAULT_TEAM_TIME}
                              onChange={(event) => handleTimeChange(team.id, event.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="subteam-grid">
                      {team.subteams.map(subteam => {
                        const stats = teamStats[team.id]?.[subteam.id] || { average: null }
                        return (
                          <div key={subteam.id} className="subteam-card">
                            <div className="subteam-header">
                              <div className="subteam-title">
                                <h4>{subteam.name}</h4>
                              </div>
                              <div className="subteam-meta">
                                <span>3 DPS + 1 Support</span>
                                {showPveScores && (
                                  <span className="team-avg">
                                    Avg DPS PVE: {stats.average !== null ? Math.round(stats.average).toLocaleString() : '--'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="slot-grid">
                              {subteam.slots.map(slot => {
                                const occupant = teamAssignments[slot.id]
                                return (
                                  <div
                                    key={slot.id}
                                    className={`team-slot ${slot.role} ${occupant ? 'filled' : ''}`}
                                    onDragOver={(event) => handleDragOver(event, slot.role)}
                                    onDrop={(event) => handleDrop(event, slot.id, slot.role)}
                                  >
                                    {occupant ? (
                                      <div
                                        className="slot-member"
                                        draggable
                                        onDragStart={(event) => handleDragStart(event, occupant)}
                                        onDragEnd={handleDragEnd}
                                      >
                                        <div className="slot-name">{occupant.name}</div>
                                        <div className="slot-meta">
                                          <span>{occupant.className}</span>
                                          {showPveScores && <span>PVE {occupant.pveScore}</span>}
                                        </div>
                                        <button
                                          className="slot-remove"
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            handleRemoveFromSlot(slot.id)
                                          }}
                                          aria-label="Remove from slot"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="slot-placeholder">
                                        {slot.label}
                                        <span className="slot-role-label">{slot.role === 'support' ? 'Support' : 'DPS'}</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showPreview && (
        <div className="preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-content" onClick={(event) => event.stopPropagation()}>
            <div className="preview-header">
              <div>
                <h2>👀 Team Preview</h2>
                <p>All squads on a single page. Click any empty slot to jump back and fill it.</p>
                <p className="preview-window-note">Window: {windowLabel}</p>
              </div>
              <button className="secondary" onClick={() => setShowPreview(false)}>
                Close
              </button>
            </div>
            <div className={`preview-grid ${teams.length <= 2 ? 'preview-grid--loose' : ''}`}>
              {teams.map(team => (
                <div key={team.id} className="preview-team">
                  <div className="preview-team-heading">
                    <h3>{team.name}</h3>
                    <span className="preview-team-date">{formatDisplayDateTime(teamSchedules[team.id], teamTimes[team.id])}</span>
                  </div>
                  <div className="preview-subteams">
                    {team.subteams.map(subteam => (
                      <div key={subteam.id} className="preview-subteam">
                        <div className="preview-subteam-header">
                          <h4>{subteam.name}</h4>
                          <span>3 DPS + 1 Support</span>
                        </div>
                        <ul className="preview-slot-list">
                          {subteam.slots.map(slot => {
                            const occupant = teamAssignments[slot.id]
                            return (
                              <li key={slot.id} className={`preview-slot ${slot.role}`}>
                                <div className="preview-slot-role">{slot.label}</div>
                                {occupant ? (
                                  <div className="preview-slot-details">
                                    <strong>{occupant.name}</strong>
                                    <span>{occupant.className}</span>
                                    {showPveScores && <span className="preview-slot-pve">PVE {occupant.pveScore}</span>}
                                  </div>
                                ) : (
                                  <div className="preview-slot-empty">Empty</div>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
