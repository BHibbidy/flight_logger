const modal = document.getElementById('searchModal');
const searchBtn = document.getElementById('manualSearchBtn');
const resetBtn = document.getElementById('resetBtn');
const closeBtn = document.getElementById('closeModal');
const form = document.getElementById('searchForm');
const submitBtn = document.getElementById('submitBtn');

const actionBtn = document.getElementById('actionBtn');
const actionText = document.getElementById('actionText');
const timeDisplay = document.getElementById('departureTimeDisplay');
const arrivalDisplay = document.getElementById('arrivalTimeDisplay');

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScE8mrENUNr7b5xjWbnLuI8XvH2tdkAIIp6l_kjirYQ17DMYA/formResponse';
const AVIATIONSTACK_KEY = '3df7722734dd81e4fbe2f89407663863';

let isDeparted = false;
let isArrived = false;
let isSearchPerformed = false;
let departureDate = null;
let arrivalDate = null;

// Dynamic Airport Discovery
let USER_AIRPORTS = JSON.parse(localStorage.getItem('user_airports') || '[]');
let ALL_AIRPORTS = [...STATIC_AIRPORTS, ...USER_AIRPORTS];

function saveUserAirport(code, data) {
    const index = ALL_AIRPORTS.findIndex(a => a.code === code);
    if (index === -1) {
        const newAirport = { code, ...data };
        USER_AIRPORTS.push(newAirport);
        ALL_AIRPORTS.push(newAirport);
        localStorage.setItem('user_airports', JSON.stringify(USER_AIRPORTS));
        console.log(`Discovered and saved airport: ${code}`);
    }
}

// Tracking latest GPS for "Unknown" discovery
let latestCoords = null;

function handleDepart(hh, mm) {
    timeDisplay.textContent = `Finding location...`;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                latestCoords = { lat: position.coords.latitude, lon: position.coords.longitude };
                const airportsInRange = findAirportsInRange(latestCoords.lat, latestCoords.lon, 20);
                if (airportsInRange.length === 0) {
                    setDeparture(null, hh, mm);
                } else if (airportsInRange.length === 1) {
                    setDeparture(airportsInRange[0], hh, mm);
                } else {
                    showAirportSelection(airportsInRange, (selected) => {
                        setDeparture(selected, hh, mm);
                    });
                }
            },
            () => setDeparture(null, hh, mm),
            { timeout: 5000 }
        );
    } else {
        setDeparture(null, hh, mm);
    }

    actionText.textContent = 'Arrive';
    isDeparted = true;
    departureDate = new Date();
    document.getElementById('date').valueAsDate = departureDate;
}

function handleArrive(hh, mm) {
    arrivalDisplay.textContent = `Finding location...`;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                latestCoords = { lat: position.coords.latitude, lon: position.coords.longitude };
                const airportsInRange = findAirportsInRange(latestCoords.lat, latestCoords.lon, 20);
                if (airportsInRange.length === 0) {
                    setArrival(null, hh, mm);
                } else if (airportsInRange.length === 1) {
                    setArrival(airportsInRange[0], hh, mm);
                } else {
                    showAirportSelection(airportsInRange, (selected) => {
                        setArrival(selected, hh, mm);
                    });
                }
            },
            () => setArrival(null, hh, mm),
            { timeout: 5000 }
        );
    } else {
        setArrival(null, hh, mm);
    }

    actionText.textContent = 'Search';
    document.getElementById('actionIcon').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    isArrived = true;
    arrivalDate = new Date();
}

function handleSearch() {
    const origin = document.getElementById('origin').value;
    const dest = document.getElementById('destination').value;
    if (origin && dest && departureDate) {
        const timeSpan = timeDisplay.querySelector('span[onblur*="departure"]');
        const timeVal = timeSpan ? timeSpan.innerText : "";
        searchFlights(origin, dest, departureDate, timeVal);
    }
    actionText.textContent = 'Log Flight';
    document.getElementById('actionIcon').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
    isSearchPerformed = true;
}

actionBtn.addEventListener('click', () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    if (!isDeparted) {
        handleDepart(hh, mm);
    } else if (!isArrived) {
        handleArrive(hh, mm);
    } else if (!isSearchPerformed) {
        handleSearch();
    } else {
        updateFormFields();
        modal.classList.add('active');
    }
});

function updateFormFields() {
    const originCode = document.getElementById('origin').value;
    const destCode = document.getElementById('destination').value;
    const distanceField = document.getElementById('distance');
    const durationField = document.getElementById('duration');

    if (originCode && destCode) {
        const origin = ALL_AIRPORTS.find(a => a.code === originCode);
        const dest = ALL_AIRPORTS.find(a => a.code === destCode);

        if (origin && dest) {
            const distMiles = getDistance(origin.lat, origin.lon, dest.lat, dest.lon);
            const distNM = distMiles * 0.868976;
            const roundedNM = Math.ceil(distNM / 10) * 10;
            distanceField.value = `${roundedNM} NM`;
        }
    }

    if (departureDate && arrivalDate && !durationField.value) {
        const diffMs = arrivalDate - departureDate;
        const hours = diffMs / 3600000;
        durationField.value = hours.toFixed(1);
    }
}

function setArrival(airport, hh, mm) {
    arrivalDisplay.classList.add('active');
    let content = '';
    const airportCode = airport ? airport.code : '???';
    document.getElementById('destination').value = airportCode;

    // Using innerHTML here for structure, but inputs are sanitized via separate functions if needed.
    // Ideally we'd build this purely with DOM nodes, but keeping it simple for now.
    // The previous implementation used innerHTML with template literals, maintained here for compatibility with existing CSS reveal effects.
    content = `<span class="editable-code" contenteditable="true" id="editableDest" onblur="syncCodeEdit('arrival', this.innerText)">${airportCode}</span> &bull; Arrived at <span class="editable-code" contenteditable="true" onblur="syncTimeEdit('arrival', this.innerText)">${hh}:${mm}</span>`;

    arrivalDisplay.innerHTML = `<span class="reveal-content">${content}</span>`;
}

function setDeparture(airport, hh, mm) {
    timeDisplay.classList.add('active');
    let content = '';
    const airportCode = airport ? airport.code : '???';
    document.getElementById('origin').value = airportCode;

    content = `<span class="editable-code" contenteditable="true" id="editableOrigin" onblur="syncCodeEdit('departure', this.innerText)">${airportCode}</span> &bull; Departed at <span class="editable-code" contenteditable="true" onblur="syncTimeEdit('departure', this.innerText)">${hh}:${mm}</span>`;

    timeDisplay.innerHTML = `<span class="reveal-content">${content}</span>`;
}

// Make globally available for HTML inline handlers (onblur)
window.syncCodeEdit = function (type, code) {
    code = code.toUpperCase().trim();
    if (code === '???' || code === '') return;

    if (type === 'departure') document.getElementById('origin').value = code;
    else document.getElementById('destination').value = code;

    if (latestCoords && !ALL_AIRPORTS.find(a => a.code === code)) {
        saveUserAirport(code, {
            name: `User Discovered (${code})`,
            lat: latestCoords.lat,
            lon: latestCoords.lon,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
    }
    updateFormFields();
};

window.syncTimeEdit = function (type, timeStr) {
    const [hh, mm] = timeStr.trim().split(':').map(Number);
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        alert('Invalid time format. Please use HH:MM (24h)');
        return;
    }

    if (type === 'departure' && departureDate) {
        departureDate.setHours(hh, mm, 0, 0);
    } else if (type === 'arrival' && arrivalDate) {
        arrivalDate.setHours(hh, mm, 0, 0);
    }
    updateFormFields();
};

async function searchFlights(origin, dest, date, departTime) {
    if (AVIATIONSTACK_KEY === 'PASTE_YOUR_KEY_HERE') return;

    const container = document.getElementById('suggestionContainer');
    container.classList.add('active');

    container.innerHTML = `
        <div class="search-loader">
            <div class="spinner"></div>
            <span>Searching for flights...</span>
        </div>
    `;

    const url = `http://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_KEY}&dep_iata=${origin}&arr_iata=${dest}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        container.innerHTML = '';

        if (data.error) {
            const errorMsg = document.createElement('div');
            errorMsg.style.marginTop = '1rem';
            errorMsg.style.color = '#ff3b30';
            errorMsg.style.fontSize = '0.8rem';

            if (data.error.code === 'function_access_restricted') {
                errorMsg.innerText = 'AviationStack Error: The free plan requires plain HTTP (fixed) or limits specific filters. If you still see this, double check your API key / plan limits.';
            } else {
                errorMsg.innerText = `API Error: ${data.error.message}`;
            }
            container.appendChild(errorMsg);
            return;
        }

        if (data.data && data.data.length > 0) {
            const [depH, depM] = departTime.split(':').map(Number);
            const departMinutes = depH * 60 + depM;

            const originAirport = ALL_AIRPORTS.find(a => a.code === origin);
            const tz = originAirport ? originAirport.tz : 'UTC';

            const match = data.data.find(f => {
                if (!f.departure.scheduled) return false;
                const schedDate = new Date(f.departure.scheduled);

                const localH = parseInt(schedDate.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', hour12: false }));
                const localM = parseInt(schedDate.toLocaleString('en-US', { timeZone: tz, minute: '2-digit' }));

                const schedMinutes = localH * 60 + localM;
                return Math.abs(schedMinutes - departMinutes) <= 30;
            });

            if (match) {
                if (!originAirport) {
                    saveUserAirport(origin, {
                        name: match.departure.airport || match.departure.iata,
                        lat: parseFloat(match.departure.latitude) || 0,
                        lon: parseFloat(match.departure.longitude) || 0,
                        tz: match.departure.timezone || 'UTC'
                    });
                }
                const destAirportInList = ALL_AIRPORTS.find(a => a.code === dest);
                if (!destAirportInList) {
                    saveUserAirport(dest, {
                        name: match.arrival.airport || match.arrival.iata,
                        lat: parseFloat(match.arrival.latitude) || 0,
                        lon: parseFloat(match.arrival.longitude) || 0,
                        tz: match.arrival.timezone || 'UTC'
                    });
                }
                displaySuggestion(match);
            } else {
                const noMatch = document.createElement('div');
                noMatch.style.margin = '1rem 0';
                noMatch.style.color = 'var(--text-color)';
                noMatch.innerText = 'No matching scheduled flights found.';
                container.appendChild(noMatch);
            }
        } else {
            const noFlights = document.createElement('div');
            noFlights.style.margin = '1rem 0';
            noFlights.style.color = 'var(--text-color)';
            noFlights.innerText = 'No flights found for this route today.';
            container.appendChild(noFlights);
        }
    } catch (err) {
        console.error('Flight search error:', err);
        container.innerHTML = '';
    }
}

function displaySuggestion(flight) {
    const container = document.getElementById('suggestionContainer');

    const originCode = document.getElementById('origin').value;
    const originAirport = ALL_AIRPORTS.find(a => a.code === originCode);

    // Safety check; strict mode might complain about variables not being used if we did const destCode = ...
    // Using simple reads as in original code.

    const originTz = originAirport ? originAirport.tz : 'UTC';

    const schedTime = new Date(flight.departure.scheduled).toLocaleTimeString([], {
        timeZone: originTz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const aircraftType = flight.aircraft ? (flight.aircraft.iata || flight.aircraft.icao || '') : '';
    const registration = flight.aircraft ? (flight.aircraft.registration || '') : '';
    const flightNo = flight.flight.number || flight.flight.iata;
    const airlineName = flight.airline.name;

    let apiDuration = null;
    if (flight.departure.scheduled && flight.arrival.scheduled) {
        const dep = new Date(flight.departure.scheduled);
        const arr = new Date(flight.arrival.scheduled);
        const diffMs = arr - dep;
        if (diffMs > 0) {
            apiDuration = (diffMs / 3600000).toFixed(1);
        }
    }

    // Create elements safely instead of innerHTML
    const box = document.createElement('div');
    box.className = 'suggestion-box';
    box.onclick = () => applySuggestion(box, flightNo, airlineName, aircraftType, registration, apiDuration);

    const h3 = document.createElement('h3');
    h3.innerText = 'Suggested Flight';
    box.appendChild(h3);

    const item = document.createElement('div');
    item.className = 'suggestion-item';

    const flightDiv = document.createElement('div');
    flightDiv.className = 'suggestion-flight';
    flightDiv.innerText = flight.flight.iata;
    item.appendChild(flightDiv);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'suggestion-time';
    timeDiv.innerHTML = `${flight.departure.iata} &rarr; ${flight.arrival.iata}`; // keep arrow entity or use text arrow
    item.appendChild(timeDiv);

    box.appendChild(item);

    const schedDiv = document.createElement('div');
    schedDiv.style.fontSize = '0.8rem';
    schedDiv.style.marginTop = '4px';
    schedDiv.style.opacity = '0.8';
    schedDiv.innerText = `Scheduled Departure: ${schedTime}`;
    box.appendChild(schedDiv);

    container.appendChild(box);
}

function applySuggestion(el, flightNo, airline, aircraftType, registration, apiDuration) {
    document.querySelectorAll('.suggestion-box').forEach(box => box.classList.remove('selected'));
    el.classList.add('selected');

    document.getElementById('flightNumber').value = flightNo;
    document.getElementById('airline').value = airline;
    if (aircraftType) document.getElementById('aircraftType').value = aircraftType;
    if (registration) document.getElementById('registration').value = registration;
    if (apiDuration) document.getElementById('duration').value = apiDuration;
};

// Math helpers
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// OPTIMIZATION: Calculate distance once, then sort.
function findAirportsInRange(lat, lon, rangeMiles) {
    // Map first to cache distance calculation
    const withDistance = ALL_AIRPORTS.map(airport => {
        return {
            airport,
            dist: getDistance(lat, lon, airport.lat, airport.lon)
        };
    });

    // Filter
    const inRange = withDistance.filter(item => item.dist <= rangeMiles);

    // Sort
    inRange.sort((a, b) => a.dist - b.dist);

    // Unwrap
    return inRange.map(item => item.airport);
}

function showAirportSelection(airports, onSelect) {
    const selectionModal = document.getElementById('airportSelectionModal');
    const listContainer = document.getElementById('airportList');
    listContainer.innerHTML = '';

    airports.forEach(airport => {
        const btn = document.createElement('button');
        btn.className = 'airport-option-btn';
        // Using innerHTML here is safe-ish because airport data is trusted/local, but textContent is better if we format it.
        // Keeping innerHTML for the <strong> tag
        btn.innerHTML = `<strong>${airport.code}</strong> - ${airport.name}`;
        btn.onclick = () => {
            onSelect(airport);
            selectionModal.classList.remove('active');
        };
        listContainer.appendChild(btn);
    });

    selectionModal.classList.add('active');
}

searchBtn.onclick = () => modal.classList.add('active');
closeBtn.onclick = () => modal.classList.remove('active');

resetBtn.onclick = () => {
    if (confirm('Are you sure you want to reset the current flight?')) {
        resetApp();
    }
};

function resetApp() {
    isDeparted = false;
    isArrived = false;
    isSearchPerformed = false;
    departureDate = null;
    arrivalDate = null;
    actionText.textContent = 'Depart';
    document.getElementById('actionIcon').innerHTML = '';
    timeDisplay.classList.remove('active');
    arrivalDisplay.classList.remove('active');
    timeDisplay.textContent = '';
    arrivalDisplay.textContent = '';
    const suggestionContainer = document.getElementById('suggestionContainer');
    suggestionContainer.innerHTML = '';
    suggestionContainer.classList.remove('active');

    form.reset();
    document.getElementById('origin').value = '';
    document.getElementById('destination').value = '';
    document.getElementById('distance').value = '';
}

window.onclick = (event) => {
    if (event.target == modal) {
        modal.classList.remove('active');
    }
}

form.onsubmit = async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    const formData = new FormData(form);

    const originCode = document.getElementById('origin').value.toUpperCase();
    const destCode = document.getElementById('destination').value.toUpperCase();
    [originCode, destCode].forEach(code => {
        if (code && !ALL_AIRPORTS.find(a => a.code === code)) {
            saveUserAirport(code, {
                name: `User Logged (${code})`,
                lat: latestCoords ? latestCoords.lat : 0,
                lon: latestCoords ? latestCoords.lon : 0,
                tz: Intl.DateTimeFormat().resolvedOptions().timeZone
            });
        }
    });

    try {
        await fetch(FORM_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });

        const overlay = document.getElementById('successOverlay');
        overlay.classList.add('active');
        modal.classList.remove('active');

        setTimeout(() => {
            overlay.classList.remove('active');
            resetApp();
            submitBtn.disabled = false;
            submitBtn.textContent = 'Log Flight';
        }, 1800);

    } catch (error) {
        console.error('Submission error:', error);
        alert('Connection error. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Flight';
    }
}
