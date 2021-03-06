import Ember from 'ember';
import Satellite from './satellite';
import Geography from './geography';
import TweenLite from 'tweenlite';
import Container from './container';

const {
  guidFor,
  run
  } = Ember;



export default class Radar {

  constructor(state) {
    this.satellites = [];
    this.tween = null;
    this.setState(state || {});
  }

  setState(state) {
    /*
     A scrollable consists of two parts, a telescope
     and a skyline.

     The telescope is the "constrained viewport", while
     the sky is the element with the full height of
     the content.
     */
    if (this.telescope && state.telescope) {
      this._teardownHandlers();
    }
    this.telescope = state.telescope;
    this.sky = state.sky;

    this.planet = this.telescope ? new Geography(this.telescope) : null;
    this.scrollContainer = this.telescope === window ? Container : this.telescope;
    this.skyline = this.sky ? new Geography(this.sky) : null;

    this.scrollX = this.scrollContainer ? this.scrollContainer.scrollLeft : 0;
    this.scrollY = this.scrollContainer ? this.scrollContainer.scrollTop : 0;
    this.posX = document.body.scrollLeft;
    this.posY = document.body.scrollTop;

    this.minimumMovement = state.minimumMovement || 15;
    this.resizeDebounce = state.resizeDebounce || 64;
    this.isTracking = state.hasOwnProperty('isTracking') ? state.isTracking : true;
    if (this.telescope && this.sky) {
      this._setupHandlers();
    }
  }

  getSatelliteZones(satellite) {
    return {
      y: this.getSatelliteYZone(satellite),
      x: this.getSatelliteXZone(satellite)
    };
  }

  getSatelliteYZone(satellite) {
    const satGeo = satellite.geography;
    let distance = 0;
    const yScalar = this.planet.height;

    if (satGeo.bottom > this.planet.top) {
      distance = satGeo.bottom - this.planet.top;
      return Math.floor(distance / yScalar);
    } else if (satGeo.top < this.planet.bottom) {
      distance = satGeo.top - this.planet.bottom;
      return Math.ceil(distance / yScalar);
    }

    return 0;
  }

  getSatelliteXZone(satellite) {
    const satGeo = satellite.geography;
    let distance = 0;
    const xScalar = this.planet.width;

    if (satGeo.right > this.planet.left) {
      distance = satGeo.right - this.planet.left;
      return Math.floor(distance / xScalar);
    } else if (satGeo.left < this.planet.right) {
      distance = satGeo.left - this.planet.right;
      return Math.ceil(distance / xScalar);
    }

    return 0;
  }

  killTween() {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
  }

  scrollToX(offset, jumpTo) {
    if (!this.scrollContainer) {
      return false;
    }
    this.killTween();
    if (jumpTo) {
      this.setScrollState(null, offset);
    } else {
      const tweenData = {
        scrollLeft: this.scrollX || 0
      };
      const radar = this;
      this.tween = TweenLite.to(
        tweenData,
        0.35,
        {
          scrollLeft: offset,
          onUpdate() {
            radar.setScrollState(null, tweenData.scrollLeft, true);
          }
        });
    }
  }

  scrollToY(offset, jumpTo) {
    if (!this.scrollContainer) {
      return false;
    }
    this.killTween();
    if (jumpTo) {
      this.setScrollState(offset, null);
    } else {
      const tweenData = {
        scrollTop: this.scrollY || 0
      };
      const radar = this;
      this.tween = TweenLite.to(
        tweenData,
        0.35,
        {
          scrollTop: offset,
          onUpdate() {
            radar.setScrollState(tweenData.scrollTop, null, true);
          }
        });
    }
  }

  setScrollState(y, x, check) {
    if (y || y === 0) {
      if (check && Math.abs(this.scrollY - y) > 3) {
        this.killTween();
        return;
      }
      this.scrollY = this.scrollContainer.scrollTop = Math.round(y);
    }
    if (x || x === 0) {
      if (check && Math.abs(this.scrollY - x) > 3) {
        this.killTween();
        return;
      }
      this.scrollX = this.scrollContainer.scrollLeft = Math.round(x);
    }
  }

  scrollToPosition(offsetY, offsetX, jumpTo) {
    if (!this.scrollContainer) {
      return false;
    }
    this.killTween();
    if (jumpTo) {
      this.setScrollState(offsetY, offsetX);
    } else {
      const tweenData = {
        scrollTop: this.scrollY || 0,
        scrollLeft: this.scrollX || 0
      };
      const radar = this;
      this.tween = TweenLite.to(
        tweenData,
        0.35,
        {
          scrollTop: offsetY,
          scrollLeft: offsetX,
          onUpdate() {
            radar.setScrollState(tweenData.scrollTop, tweenData.scrollLeft, true);
          }
        });
    }
  }

  register(component) {
    this.satellites.push(new Satellite({
      element: component.element,
      radar: this,
      id: guidFor(component)
    }));
  }

  unregister(component) {
    const key = guidFor(component);

    if (!this.satellites) {
      return;
    }

    const satellite = this.satellites.find((sat) => {
      return sat.key === key;
    });

    if (satellite) {
      const index = this.satellites.indexOf(satellite);

      this.satellites.splice(index, 1);
      satellite.destroy();
    }
  }

  isEarthquake(a, b) {
    return (Math.abs(b - a) >= this.minimumMovement);
  }

  willShiftSatellites() {}
  didShiftSatellites() {}
  willResizeSatellites() {}
  didResizeSatellites() {}
  willAdjustPosition() {}
  didAdjustPosition() {}

  _resize() {
    this.satellites.forEach((c) => {
      c.resize();
    });
  }

  resizeSatellites() {
    this.willResizeSatellites();
    this._resize();
    this.didResizeSatellites();
  }

  updateSkyline() {
    if (this.skyline) {
      this.skyline.setState();
    }
  }

  _shift(dY, dX) {
    // move the satellites
    this.satellites.forEach((c) => {
      c.shift(dY, dX);
    });

    // move the sky
    this.skyline.left -= dX;
    this.skyline.right -= dX;
    this.skyline.bottom -= dY;
    this.skyline.top -= dY;
  }

  shiftSatellites(dY, dX) {
    this.willShiftSatellites(dY, dX);
    this._shift(dY, dX);
    this.didShiftSatellites(dY, dX);
  }

  silentNight() {
    // Keeps skyline stationary when adding elements
    const _height = this.skyline.height;
    const _width = this.skyline.width;

    this.updateSkyline();

    const {
      height,
      width
    } = this.skyline;
    const dY = height - _height;
    const dX = width - _width;

    this.scrollY = this.scrollContainer.scrollTop += dY;
    this.scrollX = this.scrollContainer.scrollLeft += dX;
    this.skyline.left -= dX;
    this.skyline.right -= dX;
    this.skyline.bottom -= dY;
    this.skyline.top -= dY;
    this.rebuild();
  }

  rebuild() {
    this.posX = document.body.scrollLeft;
    this.posY = document.body.scrollTop;
    this.satellites.forEach((satellite) => {
      satellite.geography.setState();
    });
  }

  filterMovement() {
    // cache the scroll offset, and discard the cycle if
    // movement is within (x) threshold
    const scrollY = this.scrollContainer.scrollTop;
    const scrollX = this.scrollContainer.scrollLeft;
    const _scrollY = this.scrollY;
    const _scrollX = this.scrollX;

    if (this.isEarthquake(_scrollY, scrollY) || this.isEarthquake(_scrollX, scrollX)) {
      this.scrollY = scrollY;
      this.scrollX = scrollX;

      const dY = scrollY - _scrollY;
      const dX = scrollX - _scrollX;

      this.shiftSatellites(dY, dX);
    }
  }

  updateScrollPosition() {
    const _posX = this.posX;
    const _posY = this.posY;
    const posX = document.body.scrollLeft;
    const posY = document.body.scrollTop;

    if (this.isEarthquake(_posY, posY) || this.isEarthquake(_posX, posX)) {
      this.posY = posY;
      this.posX = posX;
      this.adjustPosition(posY - _posY, posX - _posX);
    }
  }

  _adjustPosition(dY, dX) {
    this.planet.top -= dY;
    this.planet.bottom -= dY;
    this.planet.left -= dX;
    this.planet.right -= dX;

    this._shift(dY, dX);
  }

  adjustPosition(dY, dX) {
    this.willAdjustPosition(dY, dX);
    this._adjustPosition(dY, dX);
    this.didAdjustPosition(dY, dX);
  }

  _setupHandlers() {
    this._resizeHandler = null;
    this._scrollHandler = null;
    this._nextResize = null;
    this._nextScroll = null;
    this._nextAdjustment = null;

    this._scrollHandler = () => {
      if (this.isTracking) {
        this._nextScroll = run.scheduleOnce('sync', this, this.filterMovement);
      }
    };
    this._resizeHandler = () => {
      this._nextResize = run.debounce(this, this.resizeSatellites, this.resizeDebounce);
    };
    this._scrollAdjuster = () => {
      this._nextAdjustment = run.scheduleOnce('sync', this, this.updateScrollPosition);
    };

    window.addEventListener('resize', this._resizeHandler, true);
    this.telescope.addEventListener('scroll', this._scrollHandler, true);
    if (this.telescope !== window) {
      window.addEventListener('scroll', this._scrollAdjuster, true);
    }
  }

  _teardownHandlers() {
    window.removeEventListener('resize', this._resizeHandler, true);
    if (this.telescope) {
      this.telescope.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this.telescope !== window) {
      window.removeEventListener('scroll', this._scrollAdjuster, true);
    }
    run.cancel(this._nextResize);
    run.cancel(this._nextScroll);
    run.cancel(this._nextAdjustment);
    this._scrollHandler = null;
    this._resizeHandler = null;
    this._scrollAdjuster = null;
  }

  // avoid retaining memory by deleting references
  // that likely contain other scopes to be torn down
  _teardownHooks() {
    this.willShiftSatellites = null;
    this.didShiftSatellites = null;
    this.willResizeSatellites = null;
    this.didResizeSatellites = null;
    this.willAdjustPosition = null;
    this.didAdjustPosition = null;
  }

  destroy() {
    this._teardownHandlers();
    this._teardownHooks();
    this.satellites.forEach((satellite) => {
      satellite.destroy();
    });
    this.satellites = null;
    this.telescope = null;
    this.sky = null;

    this.planet.destroy();
    this.planet = null;
    this.scrollContainer = null;
    this.skyline.destroy();
    this.skyline = null;
  }

}
