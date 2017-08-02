// functions and classes for HYSPLIT interactive viewer app


// a few functions first

getColor = function(d) {
    return d >= 5  ? '#800000' :
	d >= 4  ? '#ff3200' :
	d >= 3  ? '#ffb900' :
	d >= 2  ? '#b6ff41' :
	d >= 1  ? '#41ffb6' :
	d >= 0  ? '#00a4ff' :
	d >= -1 ? '#0012ff' :
	'#000080';
}

contourStyle = function(feature) {
    return {
	weight: 0,
	opacity: 1,
	color: 'white',
	fillOpacity: 0.5,
	fillColor: getColor(feature.properties.level)
    };
}

highlightFeature = function(e) {
    var contour = e.target;
    var tooltip_options = {sticky: true};
    var tooltip = L.tooltip(tooltip_options);
    contour.bindTooltip(tooltip).openTooltip();
    contour.setTooltipContent(contour.feature.properties.level_name);
}

resetHighlight = function(e) {
    // pm_layer.resetStyle(e.target);
    // info.update();
}

zoomToFeature = function(e) {
    map.fitBounds(e.target.getBounds());
}

onEachFeature = function(feature, layer) {
    layer.on({
	mouseover: highlightFeature,
	mouseout: resetHighlight,
	click: zoomToFeature
    });
}

// makeLayer = function(ind) {
//     var folder = 'data/BUFF/fwd/';
//     var file = 'height' + ind[1] + '_time' + ind[0] + '.json';
//     var contour_path = folder + file;    
//     return L.topoJson(null, {
// 	style: contourStyle,
// 	onEachFeature: function(f, l) {onEachFeature(f, l)},
// 	smoothFactor: .5,
// 	file_path: contour_path
//     });
// }

var run_hysplit = function() {
    var form = $("#hysplit");
    var lat = form.find('input[name="lat"]').val();
    var lon = form.find('input[name="lon"]').val();
    // Send the data using post with element id name and name2
    var url = 'http://appsvr.asrc.cestm.albany.edu:5000?lat=' + lat + '&lon=' + lon;
    $.post(url, callback=function(text) {
	form.append('<p>Flask says:<br>' + text + '</p>');
    });
};


// classes

L.TopoJSON = L.GeoJSON.extend({
    // A lazy-loading topojson layer for leaflet. Cool right?
    addData: function (data) {
	// correctly add topojson data
	var geojson, key;
	if (data.type === "Topology") {
	    for (key in data.objects) {
		if (data.objects.hasOwnProperty(key)) {
		    geojson = topojson.feature(data, data.objects[key]);
		    L.GeoJSON.prototype.addData.call(this, geojson);
		}
	    }
	    return this;
	}
	L.GeoJSON.prototype.addData.call(this, data);
	return this;
    },
    loadData: function(url) {
	// load the data if needed
	if (!this.dataIsLoaded) {
	    var topo = this;
	    $.getJSON(this.options.file_path, function(gjson) {
		topo.initialize(gjson, topo.options);
		topo.dataIsLoaded = true;
		return null;
	    });
	};
    },
    addTo: function (map) {
	// make sure data is loaded before adding to map
	this.loadData(this.options.file_path);
	L.GeoJSON.prototype.addTo.call(this, map);
    },
    beforeAdd: function(map) {
	// make sure data is loaded before adding to map
	this.loadData(this.options.file_path);
    },
    dataIsLoaded: false
});

L.topoJson = function (data, options) {
    return new L.TopoJSON(data, options);
};

// the topojson part of this class came from the example by Brendan
// Vinson: https://gist.github.com/brendanvinson/0e3c3c86d96863f1c33f55454705bca7
/* 
   The MIT License (MIT)
   Copyright (c) 2016 Brendan Vinson
   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:
   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   THE SOFTWARE.
*/


// omg this is pure madness
L.LayerSwitcher = L.LayerGroup.extend({
    storedLayers: [],
    values: [],
    initialize: function(options) {
	L.LayerGroup.prototype.initialize.call(this, []);
	this.values = options['values'];
	this.lazy = options['lazy'] || true;
	this.dims = this.values.map(function(x) {return x.length});
	this.ndim = this.dims.length;
	this.time = 0;
	this.height = 0;
	this.setupStorage();
	if (options['makeLayer']) {
	    this.makeLayer = options['makeLayer'];
	}
    },
    setupStorage: function() {
	var arr_len = 1;
	for (i = 0; i < this.ndim; i++) {
	    arr_len *= this.dims[i];
	}
	this.storedLayers = new Array(arr_len);
    },
    indToArrayInd: function(ind) {
	// get the 1D array index
	var arr_ind = 0;
	var dim_n = 1;
	for (i = this.ndim - 2; i >= 0; i--) {
	    // gotta jump this.dims[i + 1] times farther for every
	    // index for this dimension
	    dim_n *= this.dims[i + 1];
	    arr_ind += dim_n * ind[i];
	}
	// add back that last dimension
	arr_ind += ind[this.ndim - 1];
	return arr_ind;
    },
    valToArrayInd: function(val) {
	return this.indToArrayInd(this.getValueIndex(val));
    },
    loadLayer: function(ind) {
	var arr_ind = this.indToArrayInd(ind);
	if (!this.storedLayers[arr_ind]) {
	    this.storedLayers[arr_ind] = this.makeLayer(ind);   
	}
    },
    setIndex: function(ind) {
	this.time = ind[0];
	this.height = ind[1];
    },
    getValueIndex: function(val) {
	var ind = [];
	for (i = 0; i < this.ndim; i++) {
	    ind[i] = this.values[i].indexOf(val[i]);
	}
	return ind;
    },
    addValue: function(val) {
	this.loadLayer(this.getValueIndex(val));
	this.addLayer(this.storedLayers[this.valToArrayInd(val)]);
    },
    addIndex: function(ind) {
	this.loadLayer(ind);
	this.addLayer(this.storedLayers[this.indToArrayInd(ind)]);
    },
    removeIndex: function(ind) {
	this.removeLayer(this.storedLayers[this.indToArrayInd(ind)]);
    },
    removeValue: function(val) {
	this.removeLayer(this.storedLayers[this.valToArrayInd(val)]);
    },
    switchToValue: function(val) {
	this.clearLayers();
	this.addValue(val);
	this.setIndex(this.getValueIndex(val));
    },
    switchToIndex: function(ind) {
	this.clearLayers();
	this.addIndex(ind);
	this.setIndex(ind);
    },
    // and some special functions just for us
    switchTimeVal: function(t) {
	var time_index = this.values[0].indexOf(t);
	this.switchToIndex([time_index, this.height]);
    },
    switchHeight: function(h) {
	this.switchToIndex([this.time, h]);
    },
    loadTime: function(t) {
	var time_index = this.values[0].indexOf(t);
	this.loadLayer([time_index, this.height]);
    },
});

L.layerSwitcher = function(layers, options) {
    return new L.LayerSwitcher(layers, options);
};


// based on advice here: https://github.com/socib/Leaflet.TimeDimension/issues/19
L.TimeDimension.Layer.LayerSwitcher = L.TimeDimension.Layer.extend({

    initialize: function(layer, options) {
        L.TimeDimension.Layer.prototype.initialize.call(this, layer, options);
        this._currentLoadedTime = 0;
        this._currentTimeData = null;
    },

    onAdd: function(map) {
	// I think this should be edited somehow to start with the
	// correct time
        L.TimeDimension.Layer.prototype.onAdd.call(this, map);
        // if (this._timeDimension) {
        //     this._getDataForTime(this._timeDimension.getCurrentTime());
        // }
	this._update();
    },

    _onNewTimeLoading: function(ev) {
	// ok. Instead of getting data directly, we're going to get
	// the appropriate layer from site.contours, then call
	// loadData on it
        if (!this._map) {
            return;
        }
	// should probably be grabbing data here and firing event on
	// completion (but this is good enough for now)
	var time = ev.time;
	this.fire('timeload', {
            time: time
        });
        return;
    },

    isReady: function(time) {
	return true;
    },

    _update: function() {
	// switch to the appropriate time
        if (!this._map)
            return;
	this._currentLoadedTime = this._timeDimension.getCurrentTime();
	this._baseLayer.switchTimeVal(this._currentLoadedTime);
    }
});

L.timeDimension.layer.layerSwitcher = function(layer, options) {
    return new L.TimeDimension.Layer.LayerSwitcher(layer, options);
};


// extending the geojson time dimension layer to allow backward
// trajectories
L.TimeDimension.Layer.GeoJson2 = L.TimeDimension.Layer.GeoJson.extend({
    initialize: function(layer, options) {
	this.fwd = !!options['fwd'];
        L.TimeDimension.Layer.GeoJson.prototype.initialize.call(this, layer, options);
    },
    _update: function() {
        if (!this._map)
            return;
        if (!this._loaded) {
            return;
        }

        var time = this._timeDimension.getCurrentTime();

	if (this.fwd) {
	    var maxTime = this._timeDimension.getCurrentTime(),
		minTime = 0;
            if (this._duration) {
		var date = new Date(maxTime);
		L.TimeDimension.Util.subtractTimeDuration(date, this._duration, true);
		minTime = date.getTime();
            }
	} else {
	    var minTime = this._timeDimension.getCurrentTime(),
		maxTime = new Date(Math.max.apply(null, this._availableTimes));
	}


        // new coordinates:
        var layer = L.geoJson(null, this._baseLayer.options);
        var layers = this._baseLayer.getLayers();
        for (var i = 0, l = layers.length; i < l; i++) {
            var feature = this._getFeatureBetweenDates(layers[i].feature, minTime, maxTime);
            if (feature) {
                layer.addData(feature);
                if (this._addlastPoint && feature.geometry.type == "LineString") {
                    if (feature.geometry.coordinates.length > 0) {
                        var properties = feature.properties;
                        properties.last = true;
                        layer.addData({
                            type: 'Feature',
                            properties: properties,
                            geometry: {
                                type: 'Point',
                                coordinates: feature.geometry.coordinates[feature.geometry.coordinates.length - 1]
                            }
                        });
                    }
                }
            }
        }

        if (this._currentLayer) {
            this._map.removeLayer(this._currentLayer);
        }
        if (layer.getLayers().length) {
            layer.addTo(this._map);
            this._currentLayer = layer;
        }
    },
    _getFeatureBetweenDates: function(feature, minTime, maxTime) {
        var featureStringTimes = this._getFeatureTimes(feature);
        if (featureStringTimes.length == 0) {
            return feature;
        }
        var featureTimes = [];
        for (var i = 0, l = featureStringTimes.length; i < l; i++) {
            var time = featureStringTimes[i]
            if (typeof time == 'string' || time instanceof String) {
                time = Date.parse(time.trim());
            }
            featureTimes.push(time);
        }
	var index_min = null,
            index_max = null,
            l = featureTimes.length;
	if (this.fwd) {
	    if (featureTimes[0] > maxTime || featureTimes[l - 1] < minTime) {
		return null;
            }
            if (featureTimes[l - 1] > minTime) {
		for (var i = 0; i < l; i++) {
                    if (index_min === null && featureTimes[i] > minTime) {
			// set index_min the first time that current time is greater the minTime
			index_min = i;
                    }
                    if (featureTimes[i] > maxTime) {
			index_max = i;
			break;
                    }
		}
            }
	} else {
	    // the times are backward
	    if (featureTimes[l - 1] > maxTime || featureTimes[0] < minTime) {
		return null;
            }
            if (featureTimes[l - 1] < maxTime) {
		for (var i = 0; i < l; i++) {
                    if (index_min === null && featureTimes[i] <= maxTime) {
			// set index_min the first time that current time is less than the maxTime
			index_min = i;
                    }
                    if (featureTimes[i] < minTime) {
			index_max = i;
			break;
                    }
		}
            }
	}

        if (index_min === null) {
            index_min = 0;
        }
        if (index_max === null) {
            index_max = l;
        }
        var new_coordinates = [];
        if (feature.geometry.coordinates[0].length) {
            new_coordinates = feature.geometry.coordinates.slice(index_min, index_max);
        } else {
            new_coordinates = feature.geometry.coordinates;
        }
        return {
            type: 'Feature',
            properties: feature.properties,
            geometry: {
                type: feature.geometry.type,
                coordinates: new_coordinates
            }
        };
    }
});

L.timeDimension.layer.geoJson2 = function(layer, options) {
    return new L.TimeDimension.Layer.GeoJson2(layer, options);
};


class Site {
    // this object holds all of the site-specific objects
    constructor(name, fwd, hysplit) {
	this.name = name;
	this.fwd = fwd;
	this._hysplit = hysplit;
	this.contour_layer = this._hysplit.contour_layer;
	this.trajectory_layer = this._hysplit.trajectory_layer;
	// start at time and height = 0
	this.time = 0;
	this.height = 0;
	this.data;
	this.times;
	this.heights;
	// a layerSwitcher layer with contour topojson layers
	this.contours;
	// 
	this.trajectory;
	this.getColor = this._hysplit.getColor;
	this.time_slider;
	this.height_slider;
	this.td_layer;
    }

    get folder() {
	// get the path to the metadata json for this site
	var fwd_folder;
	if (this.fwd) {
	    fwd_folder = 'fwd/';
	} else {
	    fwd_folder = 'bck/';
	}
	return 'data/' + this.name + '/' + fwd_folder;
    }

    get meta_path() {
	// get the path to the metadata json for this site
	return this.folder + 'meta.json';
    }

    contour_path(time, height) {
	// get the path to the specified contour json file
	return this.folder + 'height' + height + '_time' + time + '.json';
    }

    highlightFeature(e) {
	var contour = e.target;
	var tooltip_options = {sticky: true};
	var tooltip = L.tooltip(tooltip_options);
	contour.bindTooltip(tooltip).openTooltip();
	contour.setTooltipContent(contour.feature.properties.level_name);
    }

    resetHighlight(e) {
	// pm_layer.resetStyle(e.target);
	// info.update();
    }

    zoomToFeature(e) {
	map.fitBounds(e.target.getBounds());
    }

    onEachFeature(feature, layer) {
	var this2 = this;
	layer.on({
	    mouseover: this2.highlightFeature,
	    mouseout: this2.resetHighlight,
	    click: this2.zoomToFeature
	});
    }

    trajStyle(feature) {
	return {
	    weight: 3,
	    opacity: .6,
	    color: '#5075DB'
	};
    }

    loadData() {
	// load the site's metadata
	var this2 = this;
	// return this so it can be used as a promise
	return $.get(this.meta_path, function(json) {
	    this2.data = json;
	    this2.times = json['times'].map(function(text) {return new Date(text)});
	    this2.heights = json['heights'];
	    // this2.makeContours();
	    var timedim_options = {times: this2.times,
				   currentTime: this2.times[0]};
	    this2.timedim = L.timeDimension(timedim_options);
	    try {
		// get the trajectory if it exists
		// this2.trajectory = json['trajectory'];
		var trajectory_geom;
		trajectory_geom = {type: 'Feature'};
		trajectory_geom['geometry'] = json['trajectory'];
		trajectory_geom['properties'] = {};
		// dealing with times
		var t0 = this2.times[0];
		var t1 = new Date(t0.getTime());
		var times2 = this2.times.slice();
		t1.setHours(t0.getHours() - 1);
		times2.unshift(t1);
		if (this2.fwd) {
		    trajectory_geom['properties']['times'] = times2;
		} else {
		    trajectory_geom['properties']['times'] = times2.reverse();
		}
		var trajectory_layer = L.geoJSON(trajectory_geom, {
		    style: this2.trajStyle,
		    smoothFactor: 1
		});
		var traj_options = {timeDimension: this2.timedim,
				    fwd: this2.fwd};
		this2.trajectory = L.timeDimension.layer.geoJson2(trajectory_layer, traj_options);
	    } catch(err) {}
	    var folder = this2.folder;
	    var makeLayer = function(ind) {
		// var folder = 'data/BUFF/fwd/';
		var file = 'height' + ind[1] + '_time' + ind[0] + '.json';
		var contour_path = folder + file;    
		return L.topoJson(null, {
		    style: contourStyle,
		    onEachFeature: function(f, l) {onEachFeature(f, l)},
		    smoothFactor: .5,
		    file_path: contour_path
		});
	    }
	    var ls_options = {values: [this2.times, this2.heights],
			      makeLayer: makeLayer};
	    this2.contours = L.layerSwitcher(ls_options);
	    var td_options = {timeDimension: this2.timedim};
	    this2.td_layer = L.timeDimension.layer.layerSwitcher(this2.contours, td_options);
	});
    }

    displayData(time, height) {
	this.contours.switchToIndex([time, parseInt(height)]);
	this.time = time;
	this.height = parseInt(height);
    }

    changeTime(time) {
	this.displayData(time, this.height);
    }

    changeHeight(height) {
	this.displayData(this.time, height);
    };

    create_time_slider() {
	var time_options = {timeDimension: this.timedim, loopButton: true,
			    timeSliderDragUpdate: true,
			    playerOptions: {minBufferReady: 0, buffer: 0}};
	this.time_slider = L.control.timeDimension(time_options);
    }

    create_height_slider() {
	var heights = this.heights;
	var this2 = this;
	this.height_slider = L.control.slider(function(h) {this2.changeHeight(h);},
					      {id: 'height_slider', orientation: 'vertical',
					       title: 'Select Height', value: 0,
					       max: heights.length - 1, position: 'bottomleft',
					       logo: 'Height', size: '100px', collapsed: false,
					       getValue: function(height) {return heights[height] + 'm';},
					       syncSlider: true });
    };

    setup_sliders(map) {
	if (!this.time_slider) {
	    this.create_time_slider();
	}
	if (!this.height_slider) {
	    this.create_height_slider();
	}
	this.time_slider.addTo(map);
	this.height_slider.addTo(map);
    };

    remove_sliders() {
	this.time_slider.remove();
	this.height_slider.remove();
    }

    clearLayers() {
	this.contour_layer.clearLayers();
	this.trajectory_layer.clearLayers();
	this.timedim.remove();
    }

    addTo(map) {
	this.setup_sliders(map);
	this.contour_layer.addLayer(this.contours);
	this.trajectory_layer.addLayer(this.trajectory);
	this.td_layer.addTo(map);
    }

    remove() {
	this.remove_sliders();
	this.clearLayers();
    }
}

class SiteSelector {
    constructor(sites, start_site_name, origin_layer, hysplit) {
	this._hysplit = hysplit;
	// the layer where the release point is stored for display on
	// the main map
	this.origin_layer = origin_layer;
	// the site markers
	this.marker_layer = L.featureGroup();
	this.start_site = start_site_name;
	this.site_info;
	this.selected;
	this.origin_circle;
	this.common_options = {};
	this.cm_options = {radius: 7, color: '#333',
			   weight: 2, opacity: .6,
			   fillOpacity: .2};
	this.cm_selected_options = {radius: 7, color: 'red',
				    weight: 2, opacity: .6,
				    fillOpacity: .2};
	this.cm_orig_options = {radius: 5, color: '#ff9000',
				weight: 2, fillOpacity: .6};
	this.addSites(sites);
    }

    mouseoverMarker(e) {
	var marker = e.target;
	marker.setStyle({
	    radius: 7,
	    weight: 2,
	    fillOpacity: .6
	});
	this.site_info.update(marker['site_name']);
    }

    mouseoutMarker(e) {
	var marker = e.target;
	marker.setStyle(marker['default_style']);
	this.site_info.update();
    }

    updateStyle(marker, style) {
	marker['default_style'] = style;
	marker.setStyle(style);
    }

    select(marker) {
	var new_site = marker['site_name'];
	// update the selected marker's style
	this.updateStyle(marker, this.cm_selected_options);
	try {
	    // update the previously selected marker's style
	    this.updateStyle(this.selected, this.cm_options);
	} catch(err) {}
	// set this marker as the new selected marker
	this.selected = marker;
	try {
	    // update the info box
	    $('#cur_site')[0].innerHTML = new_site;
	} catch(err) {}
	// update the origin point on the main map
	var lat = marker._latlng.lat;
	var lon = marker._latlng.lng;
	var origin = L.circleMarker([lat, lon]);
	this.updateStyle(origin, this.cm_orig_options)
	origin.on('mouseover', function(e) {this.mouseoverMarker(e)});
	origin.on('mouseout', function (e) {this.mouseoutMarker(e)});
	this.origin_layer.clearLayers();
	this.origin_layer.addLayer(origin);
    }

    clickMarker(e) {
	var marker = e.target;
	this.select(marker);
	var new_site = marker['site_name'];
	var cur_fwd = this._hysplit.cur_site.fwd;
	this._hysplit.changeSite(new_site, cur_fwd);
    }

    addSites(sites) {
	var this2 = this;
	$.each(sites, function(i, site) {
	    var lat = parseFloat(site['lat [degrees]']);
	    var lon = parseFloat(site['lon [degrees]']);
	    var marker;
	    marker = L.circleMarker([lat, lon]);
	    this2.updateStyle(marker, this2.cm_options)
	    marker['site_name'] = site['stid'];
	    marker.on('mouseover', function(e) {this2.mouseoverMarker(e)});
	    marker.on('mouseout', function (e) {this2.mouseoutMarker(e)});
	    marker.on('click', function(e) {this2.clickMarker(e)});
	    if (marker['site_name'] == this2.start_site) {
		this2.select(marker);
	    }
	    this2.marker_layer.addLayer(marker);
	});
    }
    
    addSiteInfo(map) {
	/* site info box in the site locator map */
	var this2 = this;
	var site_info = L.control({position: 'topleft'});
	site_info.onAdd = function (map) {
	    this._div = L.DomUtil.create('div', 'info');
	    this._div.innerHTML = '<h4>Current Site: <span id="cur_site">' +
		this2.start_site + '</span></h4>' +
		'Switch to: <span id="hov_site"></span>';
	    this.update();
	    return this._div;
	};
	site_info.update = function (props) {
	    try {
		$('#hov_site')[0].innerHTML = (props ? props : '');
	    } catch(err) {};
	};
	site_info.addTo(map);
	this.site_info = site_info;
    }

    addTo(map) {
	this.marker_layer.addTo(map);
	this.addSiteInfo(map);
    }
}


class Hysplit {
    constructor(sites_csv, start_site_name, start_site_fwd) {
	this.sites_csv = sites_csv;
	this.contour_layer = L.layerGroup([]);
	this.trajectory_layer = L.layerGroup([]);
	this.origin_layer = L.layerGroup([]);
	this.cur_site = new Site(start_site_name, start_site_fwd, this);
	this.map;
	this.sites;
	this.cached_sites = {};
	this.site_map;
	this.origin_circle;	
    }

    get_sites() {
	var this2 = this;
	var site_name;
	return $.get(this.sites_csv, function(csv) {
	    this2.sites = $.csv.toObjects(csv);
	    // set up the cached sites object
	    $.each(this2.sites, function(i, site) {
		site_name = site['stid'];
		this2.cached_sites[site_name] = {};
		this2.cached_sites[site_name][true] = null;
		this2.cached_sites[site_name][false] = null;
	    });
	});
    }

    addTileLayer() {
	L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
	    maxZoom: 18,
	    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
		'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
		'Imagery © <a href="http://mapbox.com">Mapbox</a>',
	    id: 'mapbox.light'
	}).addTo(this.map);
    }

    getColor(d) {
	return d >= 5  ? '#800000' :
	    d >= 4  ? '#ff3200' :
	    d >= 3  ? '#ffb900' :
	    d >= 2  ? '#b6ff41' :
	    d >= 1  ? '#41ffb6' :
	    d >= 0  ? '#00a4ff' :
	    d >= -1 ? '#0012ff' :
	    '#000080';
    }

    addLegend() {
	var this2 = this;
	var legend = L.control({position: 'bottomright'});
	legend.onAdd = function (map) {
	    var div = L.DomUtil.create('div', 'info legend'),
		/* grades = [0, 10, 20, 50, 100, 200, 500, 1000],*/
		grades = levels,
		labels = [],
		from, to;
	    var legend_title = '<h4>PM Levels</h4>'
	    for (var i = grades.length - 1; i >= 0; i--) {
		from = grades[i];
		to = grades[i + 1];
		labels.push('<span id="ng' + from + '">' +
			    '<i style="background:' + this2.getColor(from) + '"></i> <b>' +
			    '10<sup>' + from + '</sup>' +
			    (i + 1 < grades.length ? '&ndash;10<sup>' + to + '</sup>' : '+') +
			    '</b> ng/m<sup>3</sup></span>');
	    }
	    div.innerHTML = legend_title + labels.join('<br>');
	    return div;
	};
	legend.addTo(this.map);
    }

    addSiteSelector() {
	/* 'store' locator div */
	var locator = L.control({position: 'topright'});
	locator.onAdd = function (map) {
	    var div = L.DomUtil.create('div', 'info');
	    var site_div = document.createElement("div");
	    site_div.id = 'locator';
	    div.appendChild(site_div);
	    return div;
	};
	locator.addTo(this.map);

	// add map and background
	var site_map_options = {zoomControl: false,
				attributionControl: false};
	this.site_map = L.map('locator', site_map_options).setView([43, -76], 6);
	L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoic2tlcHRpa29zIiwiYSI6ImNqNWU2NjNhYzAwcDEycWpqdTJtNWJmNGYifQ.kxK-j2hWsX46EhH5PnsTfA', {
	    maxZoom: 18,
	    id: 'mapbox.streets'
	}).addTo(this.site_map);

	// add markers?
	var site_selector = new SiteSelector(this.sites, this.cur_site.name,
					     this.origin_layer, this);
	site_selector.addTo(this.site_map);
    }

    addSimInfo() {
	/* simulation info box */
	var sim_info = L.control({position: 'topright'});
	sim_info.onAdd = function (map) {
	    this._div = L.DomUtil.create('div', 'info');
	    this.update();
	    return this._div;
	};
	sim_info.update = function (props) {
	    var custom_form;
	    this._div.innerHTML = '<h4>Simulation Info:</h4>' +
		'<p>Release site: BUFF<br>' +
		'Trajectory: <span id="_fwd_here">Forward</span><br>' +
		'Release time: 10am<br>' +
		'More info about things, etc.</p>';
	    custom_form = '<form id="hysplit" onSubmit="run_hysplit(); return false;">' +
		'Latitude: <input type="text" name="lat"><br>' +
		'Longitude: <input type="text" name="lon"><br>' +
		'<input type="submit" value="Click me to run the model"></form>';
	    this._div.innerHTML += '<h4>Custom Simulation:</h4>' + custom_form;
	};
	sim_info.addTo(this.map);
    }

    addLayerControl() {
	var this2 = this;
	var overlayMaps = {
	    'Contour': this2.contour_layer,
	    'Trajectory': this2.trajectory_layer
	}
	L.control.layers(null, overlayMaps, {position: 'topleft'}).addTo(this.map);
    }

    addFwdButton() {
	var this2 = this;
	var switchFwd = function(btn, map) {
	    this2.changeFwd();
	}
	// var b1 = L.easyButton('fa-exchange', switchFwd);
	var b1 = L.easyButton({
	    states: [{
		icon: 'fa-exchange',
		title: 'Toggle forward and backward trajectories',
		onClick: switchFwd
	    }]
	});
	b1.addTo(h1.map);
    }

    initialize(divid) {
	var this2 = this;
	var site_name;
	var site_fwd;
	return this.get_sites().done(function() {
	    site_name = this2.cur_site.name;
	    site_fwd = this2.cur_site.fwd;
	    this2.cached_sites[site_name][site_fwd] = this2.cur_site;
	    this2.map = L.map(divid, {layers: [this2.contour_layer, this2.trajectory_layer]}).
		setView([43, -74.5], 7);
	    this2.addTileLayer();
	    this2.addLegend();
	    this2.addSiteSelector();
	    this2.origin_layer.addTo(this2.map);
	    this2.addSimInfo();
	    this2.addLayerControl();
	    this2.addFwdButton();
	    this2.cur_site.loadData().done(function() {
		this2.cur_site.addTo(this2.map);
	    });
	});
    }

    changeSite(name, fwd) {
	var this2 = this;
	var site;
	if (!this.cached_sites[name][fwd]) {
	    site = new Site(name, fwd, this);
	    this.cached_sites[name][fwd] = site;
	    site.loadData().done(function() {
		this2.cur_site.remove();
		this2.cur_site = this2.cached_sites[name][fwd];
		this2.cur_site.addTo(this2.map);
	    });
	} else {
	    this.cur_site.remove();
	    this.cur_site = this.cached_sites[name][fwd];
	    this.cur_site.addTo(this.map);
	}
    }

    changeFwd() {
	var cur_fwd = this.cur_site.fwd;
	this.changeSite(this.cur_site.name, !this.cur_site.fwd);
	// update the simulation info
	var fwd_text;
	// flip the forward text
	if (cur_fwd) {
	    fwd_text = 'Backward';
	} else {
	    fwd_text = 'Forward';
	}
	$('#_fwd_here').text(fwd_text);
    }
}
