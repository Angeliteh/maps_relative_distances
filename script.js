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
        
        map = new google.maps.Map(document.getElementById("map"), {
            center: { lat: 19.4326, lng: -99.1332 }, // CDMX como centro inicial
            zoom: 12,
            styles: [
                {
                    "featureType": "poi",
                    "elementType": "labels",
                    "stylers": [
                        { "visibility": "off" }
                    ]
                }
            ]
        });

        // Verificar si la API se cargó correctamente
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            showApiError("No se pudo cargar la API de Google Maps. Verifica tu conexión a internet.");
            return;
        }

        // Inicializar servicios de direcciones
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true, // No mostrar marcadores adicionales para las rutas
            preserveViewport: true // No cambiar el zoom al mostrar rutas
        });
        directionsRenderer.setMap(map);

        // Inicializar autocompletado para búsqueda de lugares
        setupPlacesAutocomplete();

        map.addListener("click", function (event) {
            addMarker(event.latLng);
        });

        // Event listeners
        document.getElementById("clearMarkers").addEventListener("click", clearMarkers);
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
        clearMarkers();
        
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
    clearMarkers();
    
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
    // Si es el punto de referencia (índice 0)
    if (index === 0 && window.lastReferenceAddress) {
        document.getElementById("reference-search").value = window.lastReferenceAddress;
        document.getElementById("reference-search").focus();
        // Opcional: Scrollear hacia arriba para ver el campo de entrada
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        return;
    }
    
    // Si es un punto de destino
    if (window.destinationAddresses) {
        const destinationInfo = window.destinationAddresses.find(dest => dest.index === index);
        if (destinationInfo) {
            document.getElementById("destination-search").value = destinationInfo.address;
            document.getElementById("destination-search").focus();
            // Opcional: Scrollear hacia arriba para ver el campo de entrada
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            
            // Eliminar este punto para que pueda ser reemplazado
            markers[index].setMap(null);
            markers.splice(index, 1);
            
            // Actualizar el array de direcciones
            window.destinationAddresses = window.destinationAddresses.filter(dest => dest.index !== index);
            
            // Actualizar las rutas
            updateAllRoutes();
        }
    }
}

function setupSortableList() {
    // Esperamos un poco para asegurarnos de que la lista esté creada
    setTimeout(() => {
        const distancesEl = document.getElementById("distances");
        if (!distancesEl) return;
        
        sortableList = new Sortable(distancesEl, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            handle: '.drag-handle', // Solo permitir arrastrar desde el manejador
            filter: '.reference-header', // No permitir arrastrar el encabezado de referencia
            onStart: function() {
                console.log('Iniciando arrastre');
            },
            onEnd: function(evt) {
                console.log('Terminando arrastre', evt.oldIndex, evt.newIndex);
                // Reordenar los marcadores (excepto el de referencia)
                if (markers.length > 1) {
                    // Ajustar índices si tenemos un encabezado de referencia
                    let hasReferenceHeader = document.querySelector('.reference-header') !== null;
                    let oldIndex = evt.oldIndex;
                    let newIndex = evt.newIndex;
                    
                    if (hasReferenceHeader) {
                        // Si hay un encabezado, ajustamos los índices
                        oldIndex = oldIndex - 1; // -1 para saltarnos el encabezado
                        newIndex = newIndex - 1;
                    }
                    
                    if (oldIndex >= 0 && newIndex >= 0) {
                        // Ajustar índices para tener en cuenta que el primer marcador es la referencia
                        const adjustedOldIndex = oldIndex + 1; // +1 porque el índice 0 es la referencia
                        const adjustedNewIndex = newIndex + 1;
                        
                        console.log(`Reordenando marcador de ${adjustedOldIndex} a ${adjustedNewIndex}`);
                        
                        // Mover el marcador en el array
                        const movedMarker = markers.splice(adjustedOldIndex, 1)[0];
                        markers.splice(adjustedNewIndex, 0, movedMarker);
                        
                        // Actualizar el índice en los datos almacenados
                        if (window.destinationAddresses) {
                            const movedDestination = window.destinationAddresses.find(d => d.index === adjustedOldIndex);
                            if (movedDestination) {
                                movedDestination.index = adjustedNewIndex;
                            }
                        }
                        
                        // Actualizar rutas
                        updateAllRoutes();
                    }
                }
            }
        });
        
        console.log('Sortable inicializado');
    }, 500);
}

function updateAllRoutes() {
    // Limpiar todas las rutas existentes
    activeRoutes.forEach(route => {
        if (route instanceof google.maps.DirectionsRenderer) {
            route.setMap(null);
        } else if (route instanceof google.maps.Polyline) {
            route.setMap(null);
        } else if (route instanceof google.maps.Marker) {
            // Si es un marcador de distancia
            route.setMap(null);
        }
    });
    activeRoutes = [];
    
    // Recalcular todas las rutas desde el punto de referencia
    if (markers.length > 1) {
        const origin = markers[0].getPosition();
        
        for (let i = 1; i < markers.length; i++) {
            calculateAndDisplayRoute(origin, markers[i].getPosition(), i);
        }
    }
    
    // Actualizar la lista de distancias
    updateDistances();
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
            if (status === "OK") {
                renderer.setDirections(response);
                
                // Añadir etiqueta con la distancia en la ruta
                const route = response.routes[0];
                const distance = route.legs[0].distance.text;
                const duration = route.legs[0].duration.text;
                
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
            } else {
                console.error("Error al calcular la ruta:", status);
                // Si hay un error con la API de direcciones, al menos calculamos la distancia en línea recta
                calculateStraightLineDistance(origin, destination, destinationIndex);
            }
        }
    );
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

function clearMarkers() {
    // Cerrar todas las ventanas de información
    infoWindows.forEach(window => window.close());
    infoWindows = [];
    
    // Eliminar todos los marcadores
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    referenceMarker = null;
    distancesList.innerHTML = "";
    
    // Limpiar la matriz de distancias
    document.getElementById('distance-matrix-container').innerHTML = "";
    
    // Limpiar todas las rutas
    activeRoutes.forEach(renderer => {
        if (renderer instanceof google.maps.DirectionsRenderer) {
            renderer.setMap(null);
        } else if (renderer instanceof google.maps.Polyline) {
            renderer.setMap(null);
        }
    });
    activeRoutes = [];
    
    // Restablecer la pestaña activa
    document.querySelector('.tab[data-tab="tab-reference"]').click();
}

function updateDistances() {
    if (markers.length < 2) {
        distancesList.innerHTML = "";
        return;
    }

    distancesList.innerHTML = "<h3>Distancias desde el punto de referencia:</h3>";
    
    try {
        // Primero intentamos usar el servicio de Distance Matrix
        useDistanceMatrixService();
    } catch (error) {
        // Si hay un error, usamos el cálculo de distancia en línea recta
        console.error("Error al usar Distance Matrix:", error);
        calculateStraightLineDistances();
    }
}

function useDistanceMatrixService() {
    // Usar el servicio de distancias de Google Maps
    const service = new google.maps.DistanceMatrixService();
    
    // Obtener la posición del punto de referencia
    const origin = markers[0].getPosition();
    
    // Obtener las posiciones de los demás puntos
    const destinations = markers.slice(1).map(marker => marker.getPosition());
    
    service.getDistanceMatrix(
        {
            origins: [origin],
            destinations: destinations,
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC
        },
        function(response, status) {
            if (status === "OK" && response) {
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
