/*
  Copyright (c) 2015 Jean-Marc VIGLINO,
  released under the CeCILL-B license (French BSD license)
  (http://www.cecill.info/licences/Licence_CeCILL-B_V1-en.txt).
*/

import ol_ext_inherits from '../util/ext'
import ol_control_Control from 'ol/control/Control'

/**
 * @classdesc Swipe Control.
 * @fires moving
 * @constructor
 * @extends {ol_control_Control}
 * @param {Object=} Control options.
 *  @param {ol.layer} options.layers layer to swipe
 *  @param {ol.layer} options.rightLayer layer to swipe on right side
 *  @param {string} options.className control class name
 *  @param {number} options.position position propertie of the swipe [0,1], default 0.5
 *  @param {string} options.orientation orientation propertie (vertical|horizontal), default vertical
 */
var ol_control_Swipe = function(options) {
  options = options || {};

  var button = document.createElement('button');

  var element = document.createElement('div');
  element.className = (options.className || "ol-swipe") + " ol-unselectable ol-control";
  element.appendChild(button);

  element.addEventListener("mousedown", this.move.bind(this));
  element.addEventListener("touchstart", this.move.bind(this));

  ol_control_Control.call(this, {
    element: element
  });

  // An array of listener on layer postcompose
  this.precomposeRight_ = this.precomposeRight.bind(this);
  this.precomposeLeft_ = this.precomposeLeft.bind(this);
  this.postcompose_ = this.postcompose.bind(this);

  this.layers = [];
  if (options.layers) this.addLayer(options.layers, false);
  if (options.rightLayers) this.addLayer(options.rightLayers, true);

  this.on('propertychange', function() {
    if (this.getMap()) {
      try { this.getMap().renderSync(); } catch(e) { /* ok */ }
    }
    if (this.get('orientation') === "horizontal") {
      this.element.style.top = this.get('position')*100+"%";
      this.element.style.left = "";
    } else {
      if (this.get('orientation') !== "vertical") this.set('orientation', "vertical");
      this.element.style.left = this.get('position')*100+"%";
      this.element.style.top = "";
    }
    this.element.classList.remove("horizontal", "vertical");
    this.element.classList.add(this.get('orientation'));
  }.bind(this));

  this.set('position', options.position || 0.5);
  this.set('orientation', options.orientation || 'vertical');
};
ol_ext_inherits(ol_control_Swipe, ol_control_Control);

/**
 * Set the map instance the control associated with.
 * @param {_ol_Map_} map The map instance.
 */
ol_control_Swipe.prototype.setMap = function(map) {
  var i;
  var l;

  if (this.getMap()) {
    for (i=0; i<this.layers.length; i++) {
      l = this.layers[i];
      if (l.right) l.layer.un(['precompose','prerender'], this.precomposeRight_);
      else l.layer.un(['precompose','prerender'], this.precomposeLeft_);
      l.layer.un(['postcompose','postrender'], this.postcompose_);
    }
    try { this.getMap().renderSync(); } catch(e) { /* ok */ }
  }

  ol_control_Control.prototype.setMap.call(this, map);

  if (map) {
    this._listener = [];
    for (i=0; i<this.layers.length; i++) {
      l = this.layers[i];
      if (l.right) l.layer.on(['precompose','prerender'], this.precomposeRight_);
      else l.layer.on(['precompose','prerender'], this.precomposeLeft_);
      l.layer.on(['postcompose','postrender'], this.postcompose_);
    }
    try { map.renderSync(); } catch(e) { /* ok */ }
  }
};

/** @private
*/
ol_control_Swipe.prototype.isLayer_ = function(layer){
  for (var k=0; k<this.layers.length; k++) {
    if (this.layers[k].layer === layer) return k;
  }
  return -1;
};

/** Add a layer to clip
 *	@param {ol.layer|Array<ol.layer>} layer to clip
*	@param {bool} add layer in the right part of the map, default left.
*/
ol_control_Swipe.prototype.addLayer = function(layers, right) {
  if (!(layers instanceof Array)) layers = [layers];
  for (var i=0; i<layers.length; i++) {
    var l = layers[i];
    if (this.isLayer_(l) < 0) {
      this.layers.push({ layer:l, right:right });
      if (this.getMap()) {
        if (right) l.on(['precompose','prerender'], this.precomposeRight_);
        else l.on(['precompose','prerender'], this.precomposeLeft_);
        l.on(['postcompose','postrender'], this.postcompose_);
        try { this.getMap().renderSync(); } catch(e) { /* ok */ }
      }
    }
  }
};

/** Remove all layers
 */
ol_control_Swipe.prototype.removeLayers = function() {
  var layers = [];
  this.layers.forEach(function(l) { layers.push(l.layer); });
  this.removeLayer(layers)
};

/** Remove a layer to clip
 *	@param {ol.layer|Array<ol.layer>} layer to clip
*/
ol_control_Swipe.prototype.removeLayer = function(layers) {
  if (!(layers instanceof Array)) layers = [layers];
  for (var i=0; i<layers.length; i++) {
    var k = this.isLayer_(layers[i]);
    if (k >=0 && this.getMap()) {
      if (this.layers[k].right) layers[i].un(['precompose','prerender'], this.precomposeRight_);
      else layers[i].un(['precompose','prerender'], this.precomposeLeft_);
      layers[i].un(['postcompose','postrender'], this.postcompose_);
      this.layers.splice(k,1);
    }
  }
  if (this.getMap()) {
    try { this.getMap().renderSync(); } catch(e) { /* ok */ }
  }
};

/** Get visible rectangle
 * @returns {ol.extent}
 */
ol_control_Swipe.prototype.getRectangle = function() {
  var s;
  if (this.get('orientation') === 'vertical') {
    s = this.getMap().getSize();
    return [ 0, 0, s[0]*this.get('position'), s[1]];
  } else {
    s = this.getMap().getSize();
    return [ 0, 0, s[0], s[1]*this.get('position')];
  }
};

/** @private
*/
ol_control_Swipe.prototype.move = function(e) {
  var self = this;
  var l;
  switch (e.type) {
    case 'touchcancel':
    case 'touchend':
    case 'mouseup': {
      self.isMoving = false;
      ["mouseup", "mousemove", "touchend", "touchcancel", "touchmove"]
        .forEach(function(eventName) {
          document.removeEventListener(eventName, self.move);
        });
      break;
    }
    case 'mousedown':
    case 'touchstart': {
      self.isMoving = true;
      ["mouseup", "mousemove", "touchend", "touchcancel", "touchmove"]
        .forEach(function(eventName) {
          document.addEventListener(eventName, self.move.bind(self));
        });
    }
    // fallthrough
    case 'mousemove':
    case 'touchmove': {
      if (self.isMoving) {
        if (self.get('orientation') === 'vertical') {
          var pageX = e.pageX
            || (e.touches && e.touches.length && e.touches[0].pageX)
            || (e.changedTouches && e.changedTouches.length && e.changedTouches[0].pageX);
          if (!pageX) break;
          pageX -= self.getMap().getTargetElement().getBoundingClientRect().left +
            window.pageXOffset - document.documentElement.clientLeft;

          l = self.getMap().getSize()[0];
          var w = l - Math.min(Math.max(0, l-pageX), l);
          l = w/l;
          self.set('position', l);
          self.dispatchEvent({ type: 'moving', size: [w, self.getMap().getSize()[1]], position: [l,0] });
        } else {
          var pageY = e.pageY
            || (e.touches && e.touches.length && e.touches[0].pageY)
            || (e.changedTouches && e.changedTouches.length && e.changedTouches[0].pageY);
          if (!pageY) break;
          pageY -= self.getMap().getTargetElement().getBoundingClientRect().top +
            window.pageYOffset - document.documentElement.clientTop;

          l = self.getMap().getSize()[1];
          var h = l - Math.min(Math.max(0, l-pageY), l);
          l = h/l;
          self.set('position', l);
          self.dispatchEvent({ type: 'moving', size: [self.getMap().getSize()[0],h], position: [0,l] });
        }
      }
      break;
    }
    default: break;
  }
};

/** @private
 */
ol_control_Swipe.prototype._drawRect = function(e, pts) {
  var tr = e.inversePixelTransform;
  if (tr) {
    var r = [
      [pts[0][0], pts[0][1]],
      [pts[0][0], pts[1][1]],
      [pts[1][0], pts[1][1]],
      [pts[1][0], pts[0][1]],
      [pts[0][0], pts[0][1]]
    ];
    r.forEach(function (pt, i) {
      pt = [
        (pt[0]*tr[0] - pt[1]*tr[1] + tr[4]),
        (-pt[0]*tr[2] + pt[1]*tr[3] + tr[5])
      ];
      if (!i) {
        e.context.moveTo(pt[0], pt[1]);
      } else {
        e.context.lineTo(pt[0], pt[1]);
      }
    });
  } else {
    var ratio = e.frameState.pixelRatio;
    e.context.rect(pts[0][0]*ratio,pts[0][1]*ratio,pts[1][0]*ratio,pts[1][1]*ratio);
  }
};

/** @private
*/
ol_control_Swipe.prototype.precomposeLeft = function(e) {
  var ctx = e.context;
  var size = e.frameState.size;
  ctx.save();
  ctx.beginPath();
  var pts = [[0,0],[size[0],size[1]]];
  if (this.get('orientation') === "vertical") {
    pts[1] = [
      size[0]*this.get('position'), 
      size[1]
    ];
  } else {
    pts[1] = [
      size[0],
      size[1]*this.get('position')
    ];
  }
  this._drawRect(e, pts);
  ctx.clip();
};

/** @private
*/
ol_control_Swipe.prototype.precomposeRight = function(e) {
  var ctx = e.context;
  var size = e.frameState.size;
  ctx.save();
  ctx.beginPath();
  var pts = [[0,0],[size[0],size[1]]];
  if (this.get('orientation') === "vertical") {
    pts[0] = [
      size[0]*this.get('position'), 
      0
    ];
  } else {
    pts[0] = [
      0,
      size[1]*this.get('position')
    ]
  }
  this._drawRect(e, pts);
  ctx.clip();
};

/** @private
*/
ol_control_Swipe.prototype.postcompose = function(e) {
  // restore context when decluttering is done (ol>=6)
  // https://github.com/openlayers/openlayers/issues/10096
  if (e.target.getClassName && e.target.getClassName()!=='ol-layer' && e.target.get('declutter')) {
    setTimeout(function () {
      e.context.restore();
    }, 0);
  } else {
    e.context.restore();
  }
};

export default ol_control_Swipe
