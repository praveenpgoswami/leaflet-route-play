

import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, interval, PartialObserver } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';

import * as L from 'leaflet';

export const LABELS = {
    latitude: 'latitude',
    longitude: 'longitude',
    vehicleStatus: 'vehicleStatus',
    lastInteration: 'lastInteration',
    vehicleIgnition: 'VehicleIgnitionStatus',
    vehicleSpeed: 'VehicleSpeed',
    deviceLatitude: 'DeviceLatitude',
    deviceLongitude: 'DeviceLongitude',
    accumulatedDistance: 'AccumulatedDistance',
    vehicle_type: 'vehicle_type',
    measurements: 'Measurements',
    vehicleDegree: 'VehicleDegree',
    addresses: 'addresses',
    formattedAddress: 'formatted_address',
};

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('osmMap') mapElement: ElementRef;
    private jsonURL = 'assets/json/trip.json';
    map: any;
    cordinates: any;
    pathCoordinates = [];
    latitude: any = '20.5937';
    longitude: any = '78.9629';
    zoomLevel = 5;
    mapStyle = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    timer$: Observable<number>;
    timerObserver: PartialObserver<number>;
    delay$ = new Subject();
    stopTrip$ = new Subject();
    pauseTrip$ = new Subject();
    private progressNum = 0;
    private delay = 2000;
    isRunning = true;
    isComplete = false;
    routePath = [];
    settings = { runs: 0, vehicles: [] };
    LMap: any;
    busIcon: any;
    markerIcon: any;
    currentPosition: any;

    constructor(private http: HttpClient) {  
        this.busIcon = L.icon({
            shadowUrl: null,
            iconUrl: './assets/images/moving.svg',
            iconSize: [48, 48], // size of the icon
            iconAnchor: [20, 25], // point of the icon which will correspond to marker's location
            popupAnchor: [0, -32],  // point from which the popup should open relative to the iconAnchor
        });
        this.markerIcon = L.icon({
            shadowUrl: null,
            iconUrl: './assets/images/marker-icon.png',
            iconSize: [24, 36], // size of the icon
        });
         
    }

    public getJSON(): Observable<any> {
        return this.http.get(this.jsonURL);
    }

    ngOnInit() {
        this.setMarkerRotationOption();
    }

    ngAfterViewInit() {
        this.map = L.map(this.mapElement.nativeElement).setView([this.latitude, this.longitude], this.zoomLevel);
        L.tileLayer(this.mapStyle).addTo(this.map);
        // create a red polyline from an array of LatLng points
        this.getJSON().subscribe(data => {
            this.cordinates = data.filter((x) => {
                return x.eventType === LABELS.measurements
                    && (typeof x.measurements[LABELS.deviceLatitude] !== 'undefined')
                    && (typeof x.measurements[LABELS.deviceLongitude] !== 'undefined');
            });
            if(this.cordinates.length){
                for (const cordinate of this.cordinates) {
                    this.pathCoordinates.push([cordinate.measurements[LABELS.deviceLatitude], cordinate.measurements[LABELS.deviceLongitude]]);
                }
                L.marker(this.pathCoordinates[0], { icon: this.markerIcon}).addTo(this.map);
                L.marker(this.pathCoordinates[this.pathCoordinates.length - 1], { icon: this.markerIcon}).addTo(this.map);
                const polyline = L.polyline(this.pathCoordinates, { color: '#800080', weight: 10 }).addTo(this.map);
                this.map.fitBounds(polyline.getBounds()); // zoom the map to the polyline
                this.startTrackHistory(this.cordinates);
            }
        });
    }
    /**
     * Start vehicle history tracking on map
     * @param locations Lat Long cordinates
     */
    startTrackHistory(locations) {
        if (locations.length) {
            this.timer$ = interval(this.delay)
                .pipe(
                    takeUntil(this.pauseTrip$),
                    takeUntil(this.stopTrip$),
                    take(locations.length)
                );
            this.timerObserver = {
                next: (_: number) => {
                    if (typeof locations[this.progressNum] !== 'undefined') {
                        if (this.settings.vehicles.length > 0) {
                            for (let c = 0; c < this.settings.vehicles.length; c++) {
                                this.settings.vehicles[c].icon.removeFrom(this.map);
                                delete this.settings.vehicles[c];
                            }
                            this.settings.vehicles = [];
                        }
                        const vehicle = { icon: null };
                        const DeviceLatitude = locations[this.progressNum].measurements.DeviceLatitude;
                        const DeviceLongitude = locations[this.progressNum].measurements.DeviceLongitude;
                        const vehicleDegree = locations[this.progressNum].measurements[LABELS.vehicleDegree];
                        this.currentPosition = [DeviceLatitude, DeviceLongitude];
                        vehicle.icon = L.marker(this.currentPosition, { icon: this.busIcon, rotationAngle: vehicleDegree });
                        vehicle.icon.addTo(this.map);
                        this.settings.vehicles.push(vehicle);
                        this.routePath.push(this.currentPosition);
                        // Fit the map to the markers.
                        const bounds = new L.LatLngBounds(this.routePath);
                        this.map.fitBounds(bounds, { maxZoom: 17 });
                    }
                    if (this.progressNum < locations.length) {
                        this.progressNum += 1;
                    } else {
                        this.stopTrip$.next();
                        this.isRunning = false;
                        this.isComplete = true;
                    }
                }
            };
            this.timer$.subscribe(this.timerObserver);
        }
    }

    /**
     * Set Rotation
     */
    setMarkerRotationOption(){
        var proto_initIcon = L.Marker.prototype._initIcon;
        var proto_setPos = L.Marker.prototype._setPos;

        var oldIE = (L.DomUtil.TRANSFORM === 'msTransform');

        L.Marker.addInitHook(function () {
            var iconOptions = this.options.icon && this.options.icon.options;
            var iconAnchor = iconOptions && this.options.icon.options.iconAnchor;
            if (iconAnchor) {
                iconAnchor = (iconAnchor[0] + 'px ' + iconAnchor[1] + 'px');
            }
            this.options.rotationOrigin = this.options.rotationOrigin || iconAnchor || 'center bottom' ;
            this.options.rotationAngle = this.options.rotationAngle || 0;

            // Ensure marker keeps rotated during dragging
            this.on('drag', function(e) { e.target._applyRotation(); });
        });

        L.Marker.include({
            _initIcon: function() {
                proto_initIcon.call(this);
            },

            _setPos: function (pos) {
                proto_setPos.call(this, pos);
                this._applyRotation();
            },

            _applyRotation: function () {
                if(this.options.rotationAngle) {
                    this._icon.style[L.DomUtil.TRANSFORM+'Origin'] = this.options.rotationOrigin;

                    if(oldIE) {
                        // for IE 9, use the 2D rotation
                        this._icon.style[L.DomUtil.TRANSFORM] = 'rotate(' + this.options.rotationAngle + 'deg)';
                    } else {
                        // for modern browsers, prefer the 3D accelerated version
                        this._icon.style[L.DomUtil.TRANSFORM] += ' rotateZ(' + this.options.rotationAngle + 'deg)';
                    }
                }
            },

            setRotationAngle: function(angle) {
                this.options.rotationAngle = angle;
                this.update();
                return this;
            },

            setRotationOrigin: function(origin) {
                this.options.rotationOrigin = origin;
                this.update();
                return this;
            }
        }); 
    }
}
