let map;
let markers = [];
let distancesList = document.getElementById("distances");
let referenceMarker = null;
let directionsService;
let directionsRenderer;
let activeRoutes = [];

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 19.4326, lng: -99.1332 }, // CDMX como centro inicial
        zoom: 12
    });

    // Inicializar servicios de direcciones
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true, // No mostrar marcadores adicionales para las rutas
        preserveViewport: true // No cambiar el zoom al mostrar rutas
    });
    directionsRenderer.setMap(map);

    map.addListener("click", function (event) {
        addMarker(event.latLng);
    });

    document.getElementById("clearMarkers").addEventListener("click", clearMarkers);
    
    // Mostrar mensaje informativo sobre la API
    console.log("Google Maps API cargada correctamente");
}

function addMarker(location) {
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
            title: "Punto de referencia"
        });
        markers.push(referenceMarker);
    } else {
        // Marcadores adicionales
        let marker = new google.maps.Marker({
            position: location,
            map: map,
            title: `Punto ${markers.length}`
        });
        markers.push(marker);
        
        // Mostrar ruta entre el punto de referencia y este nuevo punto
        calculateAndDisplayRoute(referenceMarker.getPosition(), location, markers.length - 1);
    }
    
    updateDistances();
}

function calculateAndDisplayRoute(origin, destination, destinationIndex) {
    // Crear un nuevo DirectionsRenderer para esta ruta específica
    let renderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
            strokeColor: getRandomColor(),
            strokeWeight: 4
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
        strokeOpacity: 0.8,
        strokeWeight: 2
    });
    
    straightLine.setMap(map);
    activeRoutes.push(straightLine);
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
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    referenceMarker = null;
    distancesList.innerHTML = "";
    
    // Limpiar todas las rutas
    activeRoutes.forEach(renderer => {
        if (renderer instanceof google.maps.DirectionsRenderer) {
            renderer.setMap(null);
        } else if (renderer instanceof google.maps.Polyline) {
            renderer.setMap(null);
        }
    });
    activeRoutes = [];
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
                    
                    if (result.status === "OK") {
                        const distance = result.distance.text;
                        const duration = result.duration.text;
                        const destinationAddress = response.destinationAddresses[index];
                        
                        li.innerHTML = `<strong>Punto ${index + 1}:</strong> Distancia: ${distance}, Tiempo: ${duration}<br>
                                       <small>Dirección aproximada: ${destinationAddress}</small>`;
                    } else {
                        li.textContent = `No se pudo calcular la distancia al punto ${index + 1}. Error: ${result.status}`;
                    }
                    
                    distancesList.appendChild(li);
                });
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
    
    markers.slice(1).forEach((marker, index) => {
        const destination = marker.getPosition();
        const distance = google.maps.geometry.spherical.computeDistanceBetween(origin, destination);
        const distanceInKm = (distance / 1000).toFixed(2);
        
        const li = document.createElement("li");
        li.innerHTML = `<strong>Punto ${index + 1}:</strong> Distancia aproximada: ${distanceInKm} km`;
        distancesList.appendChild(li);
    });
}
