let map;
let markers = [];
let distancesList = document.getElementById("distances");
let referenceMarker = null;
let directionsService;
let directionsRenderer;
let activeRoutes = [];
let routesVisible = true;
let infoWindows = [];
let autocompleteReference;
let autocompleteDestination;
let sortableList;

// Configuración del tema (claro/oscuro)
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
});

function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
        console.error("No se encontró el botón de cambio de tema");
        return;
    }
    
    const themeIcon = themeToggle.querySelector('i');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Comprobar si hay un tema guardado en localStorage
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeIcon(themeIcon, currentTheme);
        if (map) {
            updateMapStyle();
        }
    } else if (prefersDarkScheme.matches) {
        // Si el usuario prefiere tema oscuro y no hay preferencia guardada
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon(themeIcon, 'dark');
        localStorage.setItem('theme', 'dark');
        if (map) {
            updateMapStyle();
        }
    }
    
    // Evento para cambiar el tema
    themeToggle.addEventListener('click', () => {
        let theme = 'light';
        
        if (document.documentElement.getAttribute('data-theme') !== 'dark') {
            theme = 'dark';
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        
        localStorage.setItem('theme', theme);
        updateThemeIcon(themeIcon, theme);
        
        // Actualizar estilo del mapa si ya está inicializado
        if (map) {
            updateMapStyle();
        }
    });
}

// Actualizar el icono según el tema
function updateThemeIcon(iconElement, theme) {
    if (!iconElement) return;
    
    if (theme === 'dark') {
        iconElement.classList.remove('fa-moon');
        iconElement.classList.add('fa-sun');
    } else {
        iconElement.classList.remove('fa-sun');
        iconElement.classList.add('fa-moon');
    }
}

// Timeout para detectar si la API de Google Maps no se carga
let googleMapsLoadTimeout = setTimeout(function() {
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.error("Google Maps API no se cargó correctamente");
        document.getElementById('map').innerHTML = '<div class="api-error"><i class="fas fa-exclamation-triangle"></i><h3>Error al cargar Google Maps</h3><p>La API de Google Maps no se cargó correctamente. Revisa tu conexión a internet y la configuración de la API.</p><div class="api-error-details"><p>Mientras tanto, puedes usar la entrada manual de coordenadas.</p></div></div>';
        setupManualCoordinateInput();
    }
}, 5000); // 5 segundos de timeout

function initMap() {
    try {
        // Limpiar el timeout ya que la API se cargó correctamente
        clearTimeout(googleMapsLoadTimeout);
        
        // Determinar el estilo del mapa según el tema actual
        const mapStyles = getMapStyles();
        
        map = new google.maps.Map(document.getElementById("map"), {
            center: { lat: 19.4326, lng: -99.1332 }, // CDMX como centro inicial
            zoom: 12,
            styles: mapStyles
        });

        // Verificar si la API se cargó correctamente
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            showApiError("No se pudo cargar la API de Google Maps. Verifica tu conexión a internet.");
            return;
        }

        // Inicializar servicios de direcciones - Usar solo si está disponible
        try {
            directionsService = new google.maps.DirectionsService();
            directionsRenderer = new google.maps.DirectionsRenderer({
                suppressMarkers: true, // No mostrar marcadores adicionales para las rutas
                preserveViewport: true // No cambiar el zoom al mostrar rutas
            });
            directionsRenderer.setMap(map);
        } catch (error) {
            console.warn("No se pudo inicializar el servicio de direcciones:", error);
        }

        // Inicializar autocompletado para búsqueda de lugares
        setupPlacesAutocomplete();

        map.addListener("click", function (event) {
            addMarker(event.latLng);
        });

        // Event listeners
        document.getElementById("clearMarkers").addEventListener("click", clearAllMarkers);
        document.getElementById("toggleRoutes").addEventListener("click", toggleRoutes);
        document.getElementById("toggleDistanceMatrix").addEventListener("click", calculateDistanceMatrix);
        document.getElementById("set-reference").addEventListener("click", setReferenceFromSearch);
        document.getElementById("add-destination").addEventListener("click", addDestinationFromSearch);
        
        // Configurar tabs
        setupTabs();
        
        // Configurar lista reordenable
        setupSortableList();
    
        // Mostrar mensaje informativo sobre la API
        console.log("Google Maps API cargada correctamente");
    } catch (error) {
        console.error("Error al inicializar el mapa:", error);
        showApiError("Error al inicializar Google Maps: " + error.message);
    }
}

function showApiError(message) {
    // Crear un mensaje de error visible para el usuario
    const mapDiv = document.getElementById("map");
    mapDiv.innerHTML = `
        <div class="api-error">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error de Google Maps API</h3>
            <p>${message}</p>
            <div class="api-error-details">
                <p>Posibles soluciones:</p>
                <ul>
                    <li>Verifica que tu clave de API sea válida</li>
                    <li>Asegúrate de que la API de Places, Directions y Distance Matrix estén habilitadas</li>
                    <li>Revisa si hay restricciones de dominio en tu clave de API</li>
                    <li>Intenta recargar la página</li>
                </ul>
                <p>Mientras tanto, puedes seguir usando la aplicación con funcionalidad limitada.</p>
            </div>
        </div>
    `;
    
    // Habilitar entrada manual de coordenadas como alternativa
    setupManualCoordinateInput();
}

function setupManualCoordinateInput() {
    // Modificar los cuadros de búsqueda para aceptar coordenadas manualmente
    const referenceInput = document.getElementById("reference-search");
    const destinationInput = document.getElementById("destination-search");
    
    referenceInput.placeholder = "Ingresa coordenadas (ej: 19.4326, -99.1332)";
    destinationInput.placeholder = "Ingresa coordenadas (ej: 19.4326, -99.1332)";
    
    // Actualizar los botones para usar la entrada manual
    document.getElementById("set-reference").removeEventListener("click", setReferenceFromSearch);
    document.getElementById("add-destination").removeEventListener("click", addDestinationFromSearch);
    
    document.getElementById("set-reference").addEventListener("click", setReferenceManually);
    document.getElementById("add-destination").addEventListener("click", addDestinationManually);
}

function setReferenceManually() {
    const input = document.getElementById("reference-search").value;
    const coordinates = parseCoordinates(input);
    
    if (coordinates) {
        // Limpiar todos los marcadores existentes
        clearAllMarkers();
        
        // Añadir el nuevo punto de referencia
        const location = new google.maps.LatLng(coordinates.lat, coordinates.lng);
        addMarker(location, `Punto de Referencia (${coordinates.lat}, ${coordinates.lng})`);
        
        // Centrar el mapa en la nueva ubicación
        map.setCenter(location);
        map.setZoom(14);
        
        // Limpiar el campo de búsqueda
        document.getElementById("reference-search").value = "";
    } else {
        alert("Por favor, ingresa coordenadas válidas en formato: latitud, longitud");
    }
}

function addDestinationManually() {
    const input = document.getElementById("destination-search").value;
    const coordinates = parseCoordinates(input);
    
    if (coordinates) {
        // Verificar si ya tenemos un punto de referencia
        if (markers.length === 0) {
            alert("Primero debes establecer un punto de referencia.");
            return;
        }
        
        // Añadir el nuevo destino
        const location = new google.maps.LatLng(coordinates.lat, coordinates.lng);
        addMarker(location, `Punto (${coordinates.lat}, ${coordinates.lng})`);
        
        // Centrar el mapa para mostrar todos los puntos
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(marker => bounds.extend(marker.getPosition()));
        map.fitBounds(bounds);
        
        // Limpiar el campo de búsqueda
        document.getElementById("destination-search").value = "";
    } else {
        alert("Por favor, ingresa coordenadas válidas en formato: latitud, longitud");
    }
}

function parseCoordinates(input) {
    // Intentar extraer coordenadas de la entrada
    const regex = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;
    const match = input.match(regex);
    
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[3]);
        
        // Verificar que las coordenadas estén en rangos válidos
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng };
        }
    }
    
    return null;
}

function setupPlacesAutocomplete() {
    try {
        // Verificar si la API de Places está disponible
        if (typeof google.maps.places === 'undefined') {
            console.error("La API de Places no está disponible");
            setupManualCoordinateInput();
            return;
        }
        
        // Autocompletado para el punto de referencia
        const inputReference = document.getElementById("reference-search");
        autocompleteReference = new google.maps.places.Autocomplete(inputReference, {
            fields: ["geometry", "name", "formatted_address"]
        });
        
        // Autocompletado para destinos adicionales
        const inputDestination = document.getElementById("destination-search");
        autocompleteDestination = new google.maps.places.Autocomplete(inputDestination, {
            fields: ["geometry", "name", "formatted_address"]
        });
        
        // Evitar que el formulario se envíe al presionar Enter
        inputReference.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                setReferenceFromSearch();
            }
        });
        
        inputDestination.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                addDestinationFromSearch();
            }
        });
    } catch (error) {
        console.error("Error al configurar el autocompletado:", error);
        setupManualCoordinateInput();
    }
}

function setReferenceFromSearch() {
    const place = autocompleteReference.getPlace();
    
    if (!place || !place.geometry || !place.geometry.location) {
        alert("Por favor, selecciona un lugar válido de la lista de sugerencias.");
        return;
    }
    
    // Limpiar todos los marcadores existentes
    clearAllMarkers();
    
    // Guardar la dirección en una variable global
    const placeName = place.name || place.formatted_address;
    window.lastReferenceAddress = placeName;
    
    // Añadir el nuevo punto de referencia
    addMarker(place.geometry.location, placeName);
    
    // Centrar el mapa en la nueva ubicación
    map.setCenter(place.geometry.location);
    map.setZoom(14);
    
    // No limpiar el campo de búsqueda - mantener la información
    // document.getElementById("reference-search").value = "";
}

function addDestinationFromSearch() {
    const place = autocompleteDestination.getPlace();
    
    if (!place || !place.geometry || !place.geometry.location) {
        alert("Por favor, selecciona un lugar válido de la lista de sugerencias.");
        return;
    }
    
    // Verificar si ya tenemos un punto de referencia
    if (markers.length === 0) {
        alert("Primero debes establecer un punto de referencia.");
        return;
    }
    
    // Guardar la dirección en un array global
    const placeName = place.name || place.formatted_address;
    if (!window.destinationAddresses) {
        window.destinationAddresses = [];
    }
    window.destinationAddresses.push({
        index: markers.length,
        address: placeName,
        location: place.geometry.location
    });
    
    // Añadir el nuevo destino
    addMarker(place.geometry.location, placeName);
    
    // Centrar el mapa para mostrar todos los puntos
    const bounds = new google.maps.LatLngBounds();
    markers.forEach(marker => bounds.extend(marker.getPosition()));
    map.fitBounds(bounds);
    
    // No limpiar el campo de búsqueda - solo cuando el usuario añade el punto
    // Establecemos un pequeño timeout para permitir al usuario ver lo que añadió
    setTimeout(function() {
        document.getElementById("destination-search").value = "";
    }, 1000);
}

// Nueva función para editar un punto existente
function editMarker(index) {
    if (index < 0 || index >= markers.length) {
        console.error(`Índice de marcador no válido: ${index}`);
        return;
    }
    
    // Obtener el marcador a editar
    const marker = markers[index];
    
    // Obtener dirección actual (si existe)
    let currentAddress = "Sin dirección";
    if (index === 0 && window.lastReferenceAddress) {
        currentAddress = window.lastReferenceAddress;
    } else if (window.destinationAddresses) {
        const addressInfo = window.destinationAddresses.find(d => d.index === index);
        if (addressInfo) {
            currentAddress = addressInfo.address;
        }
    }
    
    // Obtener coordenadas actuales
    const position = marker.getPosition();
    const lat = position.lat().toFixed(6);
    const lng = position.lng().toFixed(6);
    
    // Crear un modal personalizado para editar el marcador
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = `
        background-color: var(--container-bg);
        color: var(--text-color);
        padding: 25px;
        border-radius: 10px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        position: relative;
    `;
    
    // Título del modal
    const title = document.createElement('h3');
    title.textContent = index === 0 ? 'Editar Punto de Referencia' : `Editar Punto #${index}`;
    title.style.marginTop = '0';
    
    // Detalles de la ubicación actual
    const currentDetails = document.createElement('div');
    currentDetails.innerHTML = `
        <p><strong>Dirección actual:</strong> ${currentAddress}</p>
        <p><strong>Coordenadas:</strong> ${lat}, ${lng}</p>
    `;
    
    // Campo para la nueva dirección
    const addressLabel = document.createElement('label');
    addressLabel.textContent = 'Nueva dirección o coordenadas:';
    addressLabel.style.display = 'block';
    addressLabel.style.marginTop = '15px';
    addressLabel.style.fontWeight = '600';
    
    const addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.placeholder = 'Ingresa dirección o coordenadas (lat, lng)';
    addressInput.style.cssText = `
        width: 100%;
        padding: 12px;
        margin: 8px 0 15px;
        border: 1px solid var(--search-box-border);
        border-radius: 6px;
        font-size: 1rem;
        background-color: var(--search-box-bg);
        color: var(--text-color);
    `;
    addressInput.value = currentAddress;
    
    // Botones de acción
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
    `;
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    cancelButton.className = 'secondary';
    cancelButton.style.cssText = `
        padding: 10px 20px;
        background-color: var(--secondary-btn);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    `;
    
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Eliminar';
    deleteButton.className = 'clear';
    deleteButton.style.cssText = `
        padding: 10px 20px;
        background-color: var(--clear-btn);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    `;
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Guardar';
    saveButton.className = 'primary';
    saveButton.style.cssText = `
        padding: 10px 20px;
        background-color: var(--primary-btn);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    `;
    
    // Agregar los botones al contenedor
    buttonsContainer.appendChild(cancelButton);
    if (index !== 0) {
        // Solo mostrar botón de eliminar para puntos que no sean de referencia
        buttonsContainer.appendChild(deleteButton);
    }
    buttonsContainer.appendChild(saveButton);
    
    // Construir el modal
    modalContent.appendChild(title);
    modalContent.appendChild(currentDetails);
    modalContent.appendChild(addressLabel);
    modalContent.appendChild(addressInput);
    modalContent.appendChild(buttonsContainer);
    modalOverlay.appendChild(modalContent);
    
    // Agregar el modal al DOM
    document.body.appendChild(modalOverlay);
    
    // Focus en el campo de entrada
    setTimeout(() => addressInput.focus(), 100);
    
    // Eventos de los botones
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
    
    // Eliminar el punto
    deleteButton.addEventListener('click', () => {
        // Confirmar eliminación
        if (confirm(`¿Estás seguro de que deseas eliminar el punto #${index}?`)) {
            // Eliminar el marcador del mapa
            marker.setMap(null);
            
            // Eliminar el marcador del array
            markers.splice(index, 1);
            
            // Actualizar las rutas y distancias
            updateMarkerLabels();
            updateAllRoutes();
            updateDistances();
            
            // Cerrar el modal
            document.body.removeChild(modalOverlay);
        }
    });
    
    // Guardar cambios
    saveButton.addEventListener('click', () => {
        const input = addressInput.value.trim();
        
        if (input === '') {
            alert('Por favor ingresa una dirección o coordenadas válidas.');
            return;
        }
        
        // Verificar si son coordenadas
        const coordinates = parseCoordinates(input);
        
        if (coordinates) {
            // Actualizar posición del marcador con coordenadas
            const newPosition = new google.maps.LatLng(coordinates.lat, coordinates.lng);
            marker.setPosition(newPosition);
            
            // Actualizar la dirección almacenada
            if (index === 0) {
                window.lastReferenceAddress = `Punto (${coordinates.lat}, ${coordinates.lng})`;
            } else if (window.destinationAddresses) {
                const addressInfo = window.destinationAddresses.find(d => d.index === index);
                if (addressInfo) {
                    addressInfo.address = `Punto (${coordinates.lat}, ${coordinates.lng})`;
                }
            }
            
            // Actualizar rutas y distancias
            updateAllRoutes();
            updateDistances();
            
            // Cerrar el modal
            document.body.removeChild(modalOverlay);
        } else {
            // Intentar geocodificar la dirección
            if (typeof google.maps.Geocoder === 'undefined') {
                alert('No se puede geocodificar la dirección. Intenta con coordenadas (lat, lng).');
                return;
            }
            
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: input }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    
                    // Actualizar posición del marcador
                    marker.setPosition(location);
                    
                    // Actualizar la dirección almacenada
                    const formattedAddress = results[0].formatted_address;
                    if (index === 0) {
                        window.lastReferenceAddress = formattedAddress;
                    } else if (window.destinationAddresses) {
                        const addressInfo = window.destinationAddresses.find(d => d.index === index);
                        if (addressInfo) {
                            addressInfo.address = formattedAddress;
                        }
                    }
                    
                    // Actualizar rutas y distancias
                    updateAllRoutes();
                    updateDistances();
                    
                    // Cerrar el modal
                    document.body.removeChild(modalOverlay);
                } else {
                    alert('No se pudo encontrar la dirección. Intenta con otro formato o usa coordenadas (lat, lng).');
                }
            });
        }
    });
}

function setupSortableList() {
    // Esperar a que exista la lista ordenable
    setTimeout(() => {
        const distancesEl = document.getElementById('distances');
        if (!distancesEl) {
            console.error("No se encontró el elemento de la lista de distancias");
            return;
        }
        
        try {
            if (sortableList) {
                sortableList.destroy();
            }
            
            sortableList = new Sortable(distancesEl, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                handle: '.drag-handle',
                filter: '.reference-header', // No permitir arrastrar el encabezado de referencia
                onStart: function() {
                    console.log('Iniciando arrastre');
                },
                onEnd: function(evt) {
                    console.log('Terminando arrastre', evt.oldIndex, evt.newIndex);
                    
                    // Si los índices son iguales, no hay cambio
                    if (evt.oldIndex === evt.newIndex) {
                        return;
                    }
                    
                    // Ajustar índices si tenemos un encabezado de referencia
                    let hasReferenceHeader = document.querySelector('.reference-header') !== null;
                    let oldIndex = evt.oldIndex;
                    let newIndex = evt.newIndex;
                    
                    if (hasReferenceHeader) {
                        oldIndex = oldIndex - 1;
                        newIndex = newIndex - 1;
                    }
                    
                    // Verificar que los índices son válidos
                    if (oldIndex >= 0 && newIndex >= 0 && oldIndex < markers.length - 1 && newIndex < markers.length - 1) {
                        // Ajustar índices para el array de marcadores (sumamos 1 porque el índice 0 es la referencia)
                        const markerOldIndex = oldIndex + 1;
                        const markerNewIndex = newIndex + 1;
                        
                        // Mover el marcador en el array
                        const movedMarker = markers.splice(markerOldIndex, 1)[0];
                        markers.splice(markerNewIndex, 0, movedMarker);
                        
                        // Actualizar etiquetas visuales
                        markers.forEach((marker, idx) => {
                            if (idx > 0) { // Saltar el marcador de referencia
                                marker.setLabel({
                                    text: idx.toString(),
                                    color: "#FFFFFF",
                                    fontWeight: "bold"
                                });
                            }
                        });
                        
                        // Actualizar rutas
                        updateAllRoutes();
                        
                        // Actualizar la lista de distancias
                        updateDistances();
                        
                        // Actualizar los datos almacenados de direcciones
                        if (window.destinationAddresses) {
                            const movedAddress = window.destinationAddresses.find(d => d.index === markerOldIndex);
                            if (movedAddress) {
                                window.destinationAddresses = window.destinationAddresses.filter(d => d.index !== markerOldIndex);
                                movedAddress.index = markerNewIndex;
                                window.destinationAddresses.push(movedAddress);
                                window.destinationAddresses.sort((a, b) => a.index - b.index);
                            }
                        }
                    }
                }
            });
            
            console.log('Sortable inicializado correctamente');
        } catch (error) {
            console.error("Error al inicializar Sortable:", error);
        }
    }, 500);
}

// Actualizar las etiquetas de los marcadores después de reordenarlos
function updateMarkerLabels() {
    // Saltar el primer marcador que es la referencia
    for (let i = 1; i < markers.length; i++) {
        const marker = markers[i];
        // Actualizar la etiqueta visible en el mapa
        if (marker.label) {
            marker.setLabel({
                text: i.toString(),
                color: marker.label.color,
                fontWeight: marker.label.fontWeight
            });
        }
    }
}

function updateAllRoutes() {
    // Limpiar todas las rutas existentes
    if (activeRoutes && activeRoutes.length > 0) {
        activeRoutes.forEach(renderer => {
            if (renderer instanceof google.maps.DirectionsRenderer) {
                renderer.setMap(null);
            } else if (renderer instanceof google.maps.Polyline) {
                renderer.setMap(null);
            }
        });
        activeRoutes = [];
    }
    
    // Si no hay suficientes marcadores, no hay nada que hacer
    if (markers.length < 2) return;
    
    // Referencia es siempre el primer marcador
    const origin = markers[0].getPosition();
    
    // Recalcular todas las rutas desde la referencia
    for (let i = 1; i < markers.length; i++) {
        const destination = markers[i].getPosition();
        
        if (routesVisible) {
            calculateAndDisplayRoute(origin, destination, i);
        } else {
            // Si las rutas están ocultas, calculamos sólo las distancias en línea recta
            calculateStraightLineDistance(origin, destination, i);
        }
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Desactivar todas las pestañas
            tabs.forEach(t => t.classList.remove('active'));
            
            // Activar la pestaña actual
            tab.classList.add('active');
            
            // Ocultar todos los contenidos
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Mostrar el contenido correspondiente
            const tabContentId = tab.getAttribute('data-tab');
            document.getElementById(tabContentId).classList.add('active');
        });
    });
}

function addMarker(location, placeName = null) {
    // Si es el primer marcador (punto de referencia)
    if (markers.length === 0) {
        referenceMarker = new google.maps.Marker({
            position: location,
            map: map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#FF0000",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#FFFFFF"
            },
            title: placeName || "Punto de referencia",
            label: {
                text: "R",
                color: "#FFFFFF",
                fontWeight: "bold"
            },
            animation: google.maps.Animation.DROP
        });
        markers.push(referenceMarker);
        
        // Añadir infoWindow para el punto de referencia
        addInfoWindow(referenceMarker, placeName || "Punto de Referencia", 0);
    } else {
        // Marcadores adicionales con números
        let markerNumber = markers.length;
        let marker = new google.maps.Marker({
            position: location,
            map: map,
            title: placeName || `Punto ${markerNumber}`,
            label: {
                text: markerNumber.toString(),
                color: "#FFFFFF",
                fontWeight: "bold"
            },
            animation: google.maps.Animation.DROP
        });
        markers.push(marker);
        
        // Añadir infoWindow para este punto
        addInfoWindow(marker, placeName || `Punto ${markerNumber}`, markerNumber);
        
        // Mostrar ruta entre el punto de referencia y este nuevo punto
        calculateAndDisplayRoute(referenceMarker.getPosition(), location, markers.length - 1);
    }
    
    updateDistances();
}

function addInfoWindow(marker, title, index) {
    let contentString = `
        <div class="info-window">
            <h4>${title}</h4>
            <p>Latitud: ${marker.getPosition().lat().toFixed(6)}</p>
            <p>Longitud: ${marker.getPosition().lng().toFixed(6)}</p>
        </div>
    `;
    
    let infoWindow = new google.maps.InfoWindow({
        content: contentString,
        maxWidth: 250
    });
    
    infoWindows.push(infoWindow);
    
    marker.addListener("click", function() {
        // Cerrar todas las otras ventanas de información
        infoWindows.forEach(window => window.close());
        
        // Abrir esta ventana de información
        infoWindow.open(map, marker);
    });
}

function calculateAndDisplayRoute(origin, destination, destinationIndex) {
    console.log(`Intentando calcular ruta desde ${origin.toString()} hasta ${destination.toString()}`);
    
    try {
        // Verificar si el servicio de direcciones está disponible
        if (!directionsService || typeof directionsService.route !== 'function') {
            console.warn("El servicio de direcciones no está disponible. Usando cálculo alternativo.");
            calculateStraightLineDistance(origin, destination, destinationIndex);
            return;
        }
        
        // Crear un nuevo DirectionsRenderer para esta ruta específica
        let renderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
                strokeColor: getRandomColor(),
                strokeWeight: 5,
                strokeOpacity: 0.8
            }
        });
        renderer.setMap(map);
        activeRoutes.push(renderer);
        
        directionsService.route(
            {
                origin: origin,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING
            },
            function(response, status) {
                console.log(`Respuesta de DirectionsService para punto ${destinationIndex}:`, status);
                if (status === "OK") {
                    renderer.setDirections(response);
                    console.log(`Ruta calculada exitosamente para punto ${destinationIndex}`);
                    
                    // Añadir etiqueta con la distancia en la ruta
                    const route = response.routes[0];
                    const distance = route.legs[0].distance.text;
                    const duration = route.legs[0].duration.text;
                    console.log(`Distancia: ${distance}, Duración: ${duration}`);
                    
                    // Encontrar un punto medio aproximado en la ruta para colocar la etiqueta
                    const path = route.overview_path;
                    const midPoint = path[Math.floor(path.length / 2)];
                    
                    // Crear un marcador personalizado para mostrar la distancia
                    const distanceMarker = new google.maps.Marker({
                        position: midPoint,
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 0,
                        },
                        label: {
                            text: distance,
                            color: "#FFFFFF",
                            fontWeight: "bold",
                            fontSize: "12px",
                            className: "route-distance-label"
                        }
                    });
                    
                    // Guardar referencia para poder eliminarlo después
                    activeRoutes.push(distanceMarker);
                    
                    // Actualizar la distancia en la lista
                    updateDistanceInList(destinationIndex, distance);
                } else {
                    console.error("Error al calcular la ruta:", status);
                    // Si hay un error con la API de direcciones, calculamos la distancia en línea recta
                    calculateStraightLineDistance(origin, destination, destinationIndex);
                }
            }
        );
    } catch (error) {
        console.error("Error al calcular la ruta:", error);
        calculateStraightLineDistance(origin, destination, destinationIndex);
    }
}

// Función para actualizar la distancia en la lista
function updateDistanceInList(index, distance) {
    const listItem = document.querySelector(`li[data-index="${index}"]`);
    if (listItem) {
        const distanceValue = listItem.querySelector('.distance-value');
        if (distanceValue) {
            distanceValue.textContent = distance;
        }
    }
}

// Función para calcular la distancia en línea recta (alternativa si la API falla)
function calculateStraightLineDistance(origin, destination, index) {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(origin, destination);
    const distanceInKm = (distance / 1000).toFixed(2);
    
    console.log(`Distancia en línea recta al punto ${index + 1}: ${distanceInKm} km`);
    
    // Dibujar una línea recta como alternativa
    const straightLine = new google.maps.Polyline({
        path: [origin, destination],
        geodesic: true,
        strokeColor: getRandomColor(),
        strokeOpacity: 0.9,
        strokeWeight: 5
    });
    
    straightLine.setMap(map);
    activeRoutes.push(straightLine);
    
    // Calcular punto medio para la etiqueta
    const midLat = (origin.lat() + destination.lat()) / 2;
    const midLng = (origin.lng() + destination.lng()) / 2;
    const midPoint = new google.maps.LatLng(midLat, midLng);
    
    // Crear un marcador para mostrar la distancia
    const distanceMarker = new google.maps.Marker({
        position: midPoint,
        map: map,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0,
        },
        label: {
            text: distanceInKm + " km",
            color: "#FFFFFF",
            fontWeight: "bold",
            fontSize: "12px",
            className: "route-distance-label"
        }
    });
    
    // Guardar referencia para poder eliminarlo después
    activeRoutes.push(distanceMarker);
}

// Función para mostrar/ocultar rutas
function toggleRoutes() {
    routesVisible = !routesVisible;
    
    activeRoutes.forEach(route => {
        if (route instanceof google.maps.DirectionsRenderer) {
            if (routesVisible) {
                route.setMap(map);
            } else {
                route.setMap(null);
            }
        } else if (route instanceof google.maps.Polyline) {
            route.setVisible(routesVisible);
        }
    });
}

// Función para generar colores aleatorios para las rutas
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function clearAllMarkers() {
    console.log("Iniciando limpieza de todos los marcadores y rutas...");
    
    try {
        // Cerrar todas las ventanas de información
        if (infoWindows && infoWindows.length > 0) {
            infoWindows.forEach(window => {
                if (window && typeof window.close === 'function') {
                    window.close();
                }
            });
            infoWindows = [];
        }
        
        // Eliminar todos los marcadores
        if (markers && markers.length > 0) {
            markers.forEach(marker => {
                if (marker && typeof marker.setMap === 'function') {
                    marker.setMap(null);
                }
            });
            markers = [];
        }
        
        // Resetear el marcador de referencia
        referenceMarker = null;
        
        // Limpiar la lista de distancias
        if (distancesList) {
            distancesList.innerHTML = "";
        }
        
        // Limpiar la matriz de distancias
        const matrixContainer = document.getElementById('distance-matrix-container');
        if (matrixContainer) {
            matrixContainer.innerHTML = "";
        }
        
        // Limpiar todas las rutas y etiquetas de distancia
        if (activeRoutes && activeRoutes.length > 0) {
            activeRoutes.forEach(route => {
                if (route) {
                    if (route instanceof google.maps.DirectionsRenderer) {
                        route.setMap(null);
                    } else if (route instanceof google.maps.Polyline) {
                        route.setMap(null);
                    } else if (route instanceof google.maps.Marker) {
                        route.setMap(null);
                    }
                }
            });
            activeRoutes = [];
        }
        
        // Limpiar datos almacenados
        window.destinationAddresses = [];
        window.lastReferenceAddress = null;
        
        // Restablecer la pestaña activa
        const referenceTab = document.querySelector('.tab[data-tab="tab-reference"]');
        if (referenceTab) {
            referenceTab.click();
        }
        
        // Limpiar el mapa de cualquier elemento residual
        if (directionsRenderer) {
            directionsRenderer.setMap(null);
        }
        
        console.log("Todos los marcadores y rutas han sido eliminados correctamente");
    } catch (error) {
        console.error("Error al limpiar marcadores:", error);
        alert("Hubo un problema al limpiar los marcadores. Por favor, recarga la página.");
    }
}

// Mantener la función original como alias para compatibilidad
function clearMarkers() {
    clearAllMarkers();
}

function updateDistances() {
    // Verificar si tenemos el elemento de la lista
    if (!distancesList) {
        distancesList = document.getElementById("distances");
        if (!distancesList) {
            console.error("No se pudo encontrar el elemento de la lista de distancias");
            return;
        }
    }
    
    // Limpiar la lista actual
    distancesList.innerHTML = "";
    
    // Verificar si hay suficientes marcadores para calcular distancias
    if (markers.length < 2) {
        return;
    }
    
    // El primer marcador es siempre la referencia
    const reference = markers[0];
    const referencePosition = reference.getPosition();
    
    // Si tenemos un marcador de referencia, mostrar su información en un encabezado
    if (window.lastReferenceAddress) {
        const referenceHeader = document.createElement("div");
        referenceHeader.className = "reference-header";
        referenceHeader.innerHTML = `
            <div class="reference-info">
                <h3><i class="fas fa-star"></i> Punto de Referencia</h3>
                <p>${window.lastReferenceAddress}</p>
            </div>
            <div class="actions">
                <button onclick="editMarker(0)" class="edit-btn" title="Editar punto de referencia">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button onclick="centerOnMarker(0)" title="Centrar mapa en este punto">
                    <i class="fas fa-crosshairs"></i>
                </button>
            </div>
        `;
        distancesList.appendChild(referenceHeader);
    }
    
    // Añadir cada destino a la lista con su distancia
    for (let i = 1; i < markers.length; i++) {
        const destination = markers[i];
        
        // Obtener la dirección guardada (si existe)
        let addressText = `Punto ${i}`;
        if (window.destinationAddresses) {
            const addressInfo = window.destinationAddresses.find(dest => dest.index === i);
            if (addressInfo && addressInfo.address) {
                addressText = addressInfo.address;
            }
        }
        
        // Calcular distancia en línea recta como respaldo
        const destinationPosition = destination.getPosition();
        const straightLineDistance = google.maps.geometry.spherical.computeDistanceBetween(
            referencePosition, destinationPosition);
        
        // Formatear la distancia en línea recta
        const distanceTextKm = (straightLineDistance / 1000).toFixed(2) + " km";
        const distanceTextM = Math.round(straightLineDistance) + " m";
        
        // Crear elemento de lista para este destino
        const listItem = document.createElement("li");
        listItem.setAttribute("data-index", i);
        listItem.className = "sortable-item";
        
        // Contenido del elemento de lista
        listItem.innerHTML = `
            <div class="drag-handle" title="Arrastrar para reordenar">
                <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="distance-info">
                <strong>${addressText}</strong>
                <div class="distance-details">
                    <span class="badge route-distance">
                        <i class="fas fa-road"></i> <span class="distance-value">${distanceTextKm}</span>
                    </span>
                    <span class="badge straight-distance" title="Distancia en línea recta">
                        <i class="fas fa-ruler"></i> ${distanceTextM}
                    </span>
                </div>
            </div>
            <div class="actions">
                <button onclick="editMarker(${i})" class="edit-btn" title="Editar punto">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="centerOnMarker(${i})" title="Centrar mapa en este punto">
                    <i class="fas fa-crosshairs"></i>
                </button>
                <button onclick="deleteMarker(${i})" class="clear" title="Eliminar punto">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        distancesList.appendChild(listItem);
    }
    
    // Reinicializar Sortable después de actualizar la lista
    if (sortableList) {
        sortableList.destroy();
    }
    setupSortableList();
}

// Función para eliminar un marcador específico
function deleteMarker(index) {
    if (index < 0 || index >= markers.length) {
        console.error(`Índice de marcador no válido: ${index}`);
        return;
    }
    
    // Confirmar eliminación
    if (confirm(`¿Estás seguro de que deseas eliminar el punto #${index}?`)) {
        // Obtener el marcador a eliminar
        const marker = markers[index];
        
        // Eliminar el marcador del mapa
        if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
        }
        
        // Eliminar el marcador del array
        markers.splice(index, 1);
        
        // Actualizar los datos almacenados
        if (window.destinationAddresses) {
            window.destinationAddresses = window.destinationAddresses.filter(d => d.index !== index);
            
            // Actualizar los índices después de la eliminación
            window.destinationAddresses.forEach((dest, idx) => {
                dest.index = idx + 1; // +1 porque el índice 0 es la referencia
            });
        }
        
        // Actualizar las etiquetas de los marcadores
        updateMarkerLabels();
        
        // Actualizar rutas y distancias
        updateAllRoutes();
        updateDistances();
        
        console.log(`Marcador #${index} eliminado correctamente`);
    }
}

function useDistanceMatrixService() {
    console.log('Iniciando cálculo de matriz de distancias');
    // Usar el servicio de distancias de Google Maps
    const service = new google.maps.DistanceMatrixService();
    
    // Obtener la posición del punto de referencia
    const origin = markers[0].getPosition();
    console.log('Punto de referencia:', origin.toString());
    
    // Obtener las posiciones de los demás puntos
    const destinations = markers.slice(1).map(marker => marker.getPosition());
    console.log('Destinos:', destinations.map(d => d.toString()));
    
    service.getDistanceMatrix(
        {
            origins: [origin],
            destinations: destinations,
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC
        },
        function(response, status) {
            console.log('Respuesta de DistanceMatrix:', status);
            if (status === "OK" && response) {
                console.log('Matriz de distancias calculada exitosamente');
                const results = response.rows[0].elements;
                
                results.forEach((result, index) => {
                    const li = document.createElement("li");
                    li.setAttribute("data-index", index + 1); // +1 porque el índice 0 es la referencia
                    
                    // Añadir el manejador de arrastre
                    const dragHandle = document.createElement("div");
                    dragHandle.className = "drag-handle";
                    dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
                    li.appendChild(dragHandle);
                    
                    if (result.status === "OK") {
                        const distance = result.distance.text;
                        const duration = result.duration.text;
                        const destinationAddress = response.destinationAddresses[index];
                        const markerTitle = markers[index + 1].getTitle();
                        
                        const distanceInfo = document.createElement("div");
                        distanceInfo.className = "distance-info";
                        distanceInfo.innerHTML = `
                            <strong>${markerTitle}</strong> <span class="badge">${distance}</span>
                            <div>Tiempo estimado: ${duration}</div>
                            <small>Dirección aproximada: ${destinationAddress}</small>
                        `;
                        li.appendChild(distanceInfo);
                        
                        const actions = document.createElement("div");
                        actions.className = "actions";
                        actions.innerHTML = `
                            <button class="secondary edit-btn" onclick="editMarker(${index + 1})"><i class="fas fa-edit"></i> Editar</button>
                            <button class="secondary" onclick="centerOnMarker(${index + 1})"><i class="fas fa-map-marked-alt"></i> Ver en mapa</button>
                        `;
                        li.appendChild(actions);
                    } else {
                        const distanceInfo = document.createElement("div");
                        distanceInfo.className = "distance-info";
                        distanceInfo.innerHTML = `
                            <strong>Punto ${index + 1}</strong>
                            <div class="warning">No se pudo calcular la distancia. Error: ${result.status}</div>
                        `;
                        li.appendChild(distanceInfo);
                        
                        const actions = document.createElement("div");
                        actions.className = "actions";
                        actions.innerHTML = `
                            <button class="secondary edit-btn" onclick="editMarker(${index + 1})"><i class="fas fa-edit"></i> Editar</button>
                        `;
                        li.appendChild(actions);
                    }
                    
                    distancesList.appendChild(li);
                });
                
                // Añadir también un botón para editar el punto de referencia
                if (markers.length > 0) {
                    const referenceTitle = markers[0].getTitle();
                    const referenceHeader = document.createElement("div");
                    referenceHeader.className = "reference-header";
                    referenceHeader.innerHTML = `
                        <div class="reference-info">
                            <strong>Punto de Referencia:</strong> ${referenceTitle}
                        </div>
                        <div class="actions">
                            <button class="secondary edit-btn" onclick="editMarker(0)"><i class="fas fa-edit"></i> Editar Referencia</button>
                        </div>
                    `;
                    
                    // Insertar al inicio de la lista
                    distancesList.insertBefore(referenceHeader, distancesList.firstChild);
                }
            } else {
                console.error("Error en Distance Matrix:", status, response);
                // Si hay un error con la API, usamos el cálculo de distancia en línea recta
                calculateStraightLineDistances();
            }
        }
    );
}

function calculateStraightLineDistances() {
    const origin = markers[0].getPosition();
    
    distancesList.innerHTML = "<h3>Distancias en línea recta (aproximadas):</h3>";
    distancesList.innerHTML += "<p class='warning'>Nota: Usando cálculo alternativo debido a restricciones de la API</p>";
    
    // Añadir el punto de referencia primero
    if (markers.length > 0) {
        const referenceTitle = markers[0].getTitle();
        const referenceHeader = document.createElement("div");
        referenceHeader.className = "reference-header";
        referenceHeader.innerHTML = `
            <div class="reference-info">
                <strong>Punto de Referencia:</strong> ${referenceTitle}
            </div>
            <div class="actions">
                <button class="secondary edit-btn" onclick="editMarker(0)"><i class="fas fa-edit"></i> Editar Referencia</button>
            </div>
        `;
        distancesList.appendChild(referenceHeader);
    }
    
    markers.slice(1).forEach((marker, index) => {
        const destination = marker.getPosition();
        const distance = google.maps.geometry.spherical.computeDistanceBetween(origin, destination);
        const distanceInKm = (distance / 1000).toFixed(2);
        const markerTitle = marker.getTitle();
        
        const li = document.createElement("li");
        li.setAttribute("data-index", index + 1);
        
        // Añadir el manejador de arrastre
        const dragHandle = document.createElement("div");
        dragHandle.className = "drag-handle";
        dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        li.appendChild(dragHandle);
        
        const distanceInfo = document.createElement("div");
        distanceInfo.className = "distance-info";
        distanceInfo.innerHTML = `
            <strong>${markerTitle}</strong> <span class="badge">${distanceInKm} km</span>
        `;
        li.appendChild(distanceInfo);
        
        const actions = document.createElement("div");
        actions.className = "actions";
        actions.innerHTML = `
            <button class="secondary edit-btn" onclick="editMarker(${index + 1})"><i class="fas fa-edit"></i> Editar</button>
            <button class="secondary" onclick="centerOnMarker(${index + 1})"><i class="fas fa-map-marked-alt"></i> Ver en mapa</button>
        `;
        li.appendChild(actions);
        
        distancesList.appendChild(li);
    });
}

// Función para centrar el mapa en un marcador específico
function centerOnMarker(index) {
    // +1 porque el índice 0 es el punto de referencia
    const marker = markers[index];
    
    if (marker) {
        map.panTo(marker.getPosition());
        map.setZoom(15);
        
        // Abrir la ventana de información del marcador
        google.maps.event.trigger(marker, 'click');
    }
}

// Función para calcular la matriz de distancias entre todos los puntos
function calculateDistanceMatrix() {
    if (markers.length < 2) {
        alert("Se necesitan al menos 2 puntos para calcular la matriz de distancias");
        return;
    }
    
    // Cambiar a la pestaña de matriz
    document.querySelector('.tab[data-tab="tab-matrix"]').click();
    
    const matrixContainer = document.getElementById('distance-matrix-container');
    matrixContainer.innerHTML = "<p>Calculando matriz de distancias...</p>";
    
    const service = new google.maps.DistanceMatrixService();
    
    // Obtener todas las posiciones
    const positions = markers.map(marker => marker.getPosition());
    
    service.getDistanceMatrix(
        {
            origins: positions,
            destinations: positions,
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC
        },
        function(response, status) {
            if (status === "OK" && response) {
                // Crear la tabla HTML
                let tableHTML = `
                    <h3>Matriz de Distancias entre Puntos</h3>
                    <table class="distance-matrix">
                        <tr>
                            <th>Punto</th>
                `;
                
                // Crear encabezados de columna
                for (let i = 0; i < markers.length; i++) {
                    const label = i === 0 ? "Ref" : i;
                    tableHTML += `<th>${label}</th>`;
                }
                
                tableHTML += "</tr>";
                
                // Crear filas con datos
                response.rows.forEach((row, rowIndex) => {
                    const rowLabel = rowIndex === 0 ? "Ref" : rowIndex;
                    tableHTML += `<tr><th>${rowLabel}</th>`;
                    
                    row.elements.forEach((element, colIndex) => {
                        if (rowIndex === colIndex) {
                            // Diagonal (misma ubicación)
                            tableHTML += `<td>-</td>`;
                        } else if (element.status === "OK") {
                            tableHTML += `<td>${element.distance.text}</td>`;
                        } else {
                            tableHTML += `<td>N/A</td>`;
                        }
                    });
                    
                    tableHTML += "</tr>";
                });
                
                tableHTML += "</table>";
                
                matrixContainer.innerHTML = tableHTML;
            } else {
                matrixContainer.innerHTML = `
                    <div class="warning">
                        No se pudo calcular la matriz de distancias. Error: ${status}
                    </div>
                `;
                
                // Calcular manualmente las distancias en línea recta
                createStraightLineDistanceMatrix(positions);
            }
        }
    );
}

// Función alternativa para crear una matriz de distancias en línea recta
function createStraightLineDistanceMatrix(positions) {
    let tableHTML = `
        <h3>Matriz de Distancias en Línea Recta (aproximadas)</h3>
        <p class="warning">Usando cálculo alternativo debido a restricciones de la API</p>
        <table class="distance-matrix">
            <tr>
                <th>Punto</th>
    `;
    
    // Crear encabezados de columna
    for (let i = 0; i < positions.length; i++) {
        const label = i === 0 ? "Ref" : i;
        tableHTML += `<th>${label}</th>`;
    }
    
    tableHTML += "</tr>";
    
    // Crear filas con datos
    positions.forEach((origin, rowIndex) => {
        const rowLabel = rowIndex === 0 ? "Ref" : rowIndex;
        tableHTML += `<tr><th>${rowLabel}</th>`;
        
        positions.forEach((destination, colIndex) => {
            if (rowIndex === colIndex) {
                // Diagonal (misma ubicación)
                tableHTML += `<td>-</td>`;
            } else {
                const distance = google.maps.geometry.spherical.computeDistanceBetween(origin, destination);
                const distanceInKm = (distance / 1000).toFixed(2);
                tableHTML += `<td>${distanceInKm} km</td>`;
            }
        });
        
        tableHTML += "</tr>";
    });
    
    tableHTML += "</table>";
    
    document.getElementById('distance-matrix-container').innerHTML += tableHTML;
}

// Obtener estilos del mapa según el tema
function getMapStyles() {
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    
    if (isDarkTheme) {
        return [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
                featureType: "administrative.locality",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
            },
            {
                featureType: "poi",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
            },
            {
                featureType: "poi.park",
                elementType: "geometry",
                stylers: [{ color: "#263c3f" }],
            },
            {
                featureType: "poi.park",
                elementType: "labels.text.fill",
                stylers: [{ color: "#6b9a76" }],
            },
            {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ color: "#38414e" }],
            },
            {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#212a37" }],
            },
            {
                featureType: "road",
                elementType: "labels.text.fill",
                stylers: [{ color: "#9ca5b3" }],
            },
            {
                featureType: "road.highway",
                elementType: "geometry",
                stylers: [{ color: "#746855" }],
            },
            {
                featureType: "road.highway",
                elementType: "geometry.stroke",
                stylers: [{ color: "#1f2835" }],
            },
            {
                featureType: "road.highway",
                elementType: "labels.text.fill",
                stylers: [{ color: "#f3d19c" }],
            },
            {
                featureType: "transit",
                elementType: "geometry",
                stylers: [{ color: "#2f3948" }],
            },
            {
                featureType: "transit.station",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
            },
            {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#17263c" }],
            },
            {
                featureType: "water",
                elementType: "labels.text.fill",
                stylers: [{ color: "#515c6d" }],
            },
            {
                featureType: "water",
                elementType: "labels.text.stroke",
                stylers: [{ color: "#17263c" }],
            },
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ];
    } else {
        return [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ];
    }
}

// Actualizar el estilo del mapa cuando cambia el tema
function updateMapStyle() {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const styles = isDarkMode ? [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        {
            featureType: "administrative.locality",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
        },
        {
            featureType: "poi",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
        },
        {
            featureType: "poi.park",
            elementType: "geometry",
            stylers: [{ color: "#263c3f" }],
        },
        {
            featureType: "poi.park",
            elementType: "labels.text.fill",
            stylers: [{ color: "#6b9a76" }],
        },
        {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#38414e" }],
        },
        {
            featureType: "road",
            elementType: "geometry.stroke",
            stylers: [{ color: "#212a37" }],
        },
        {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9ca5b3" }],
        },
        {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ color: "#746855" }],
        },
        {
            featureType: "road.highway",
            elementType: "geometry.stroke",
            stylers: [{ color: "#1f2835" }],
        },
        {
            featureType: "road.highway",
            elementType: "labels.text.fill",
            stylers: [{ color: "#f3d19c" }],
        },
        {
            featureType: "transit",
            elementType: "geometry",
            stylers: [{ color: "#2f3948" }],
        },
        {
            featureType: "transit.station",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
        },
        {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#17263c" }],
        },
        {
            featureType: "water",
            elementType: "labels.text.fill",
            stylers: [{ color: "#515c6d" }],
        },
        {
            featureType: "water",
            elementType: "labels.text.stroke",
            stylers: [{ color: "#17263c" }],
        },
    ] : [];
    
    if (map) {
        map.setOptions({ styles: styles });
    }
}
