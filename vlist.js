/**
 * The MIT License (MIT)
 *
 * Copyright (C) 2013 Sergi Mansilla
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

/**
 * Creates a virtually-rendered scrollable list.
 * @param {object} config
 * @constructor
 */
function VirtualList(config) {
  var width = (config && config.w + 'px') || '100%';
  var height = (config && config.h + 'px') || '100%';
  var itemHeight = this.itemHeight = config.itemHeight;

  this.lastFrom = -1;
  this.loading = false;
  this.request = null;
  this.getNodes = config.getNodes;
  this.generatorFn = config.generatorFn;
  this.totalRows = 0;
  this.nextChunk = false;

  this.scroller = VirtualList.createScroller(0);
  this.container = VirtualList.createContainer(width, height);
  this.container.appendChild(this.scroller);

  var screenItemsLen = Math.ceil(config.h / itemHeight);
  // Cache 4 times the number of items that fit in the container viewport
  this.cachedItemsLen = screenItemsLen * 3;
  this._renderChunk(this.container, 0);

  var self = this;
  var lastRepaintY;
  var maxBuffer = screenItemsLen * itemHeight;
  var lastScrolled = 0;

  // As soon as scrolling has stopped, this interval asynchronouslyremoves all
  // the nodes that are not used anymore
  this.rmNodeInterval = setInterval(function() {
    if (Date.now() - lastScrolled > 100) {
      var badNodes = document.querySelectorAll('[data-rm="1"]');
      for (var i = 0, l = badNodes.length; i < l; i++) {
        self.container.removeChild(badNodes[i]);
      }
    }
  }, 300);

  function onScroll(e) {
    // Delay the render in case the user is scrolling very fast, and won't see the directly adjacent items.
    setTimeout(function() {
      var scrollTop = e.target.scrollTop; // Triggers reflow
      if (!lastRepaintY || Math.abs(scrollTop - lastRepaintY) > maxBuffer) {
	var first = parseInt(scrollTop / itemHeight) - screenItemsLen;
	self._renderChunk(self.container, first < 0 ? 0 : first);
	lastRepaintY = scrollTop;
      }

      lastScrolled = Date.now();
      e.preventDefault && e.preventDefault();
    }, 200);
  }

  this.container.addEventListener('scroll', onScroll);
}

VirtualList.prototype.createRow = function(item, i) {
  var item = this.generatorFn(item);
  item.classList.add('vrow');
  item.style.position = 'absolute';
  item.style.top = (i * this.itemHeight) + 'px';
  return item;
};

/**
 * Renders a particular, consecutive chunk of the total rows in the list. To
 * keep acceleration while scrolling, we mark the nodes that are candidate for
 * deletion instead of deleting them right away, which would suddenly stop the
 * acceleration. We delete them once scrolling has finished.
 *
 * @param {Node} node Parent node where we want to append the children chunk.
 * @param {Number} from Starting position, i.e. first children index.
 * @return {void}
 */
VirtualList.prototype._renderChunk = function(node, from) {
  var self = this;

  if (self.loading) {
    // If we are already loading items, save this chunk render to be executed next.
    // This will replace any other queued chunk that is now outdated.
    self.nextChunk = {
      node: node,
      from: from
    }
  }
  else {
    self.nextChunk = false;
    self.loading = true;

    // Get all new items.
    this.getNodes(from, self.cachedItemsLen, function(items, newTotalRows) {
      self.updateTotalRows(newTotalRows);

      // Append all the new rows in a document fragment that we will later append to
      // the parent node
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < items.length; i++) {
	fragment.appendChild(self.createRow(items[i], from + i));
      }

      // Hide and mark obsolete nodes for deletion.
      for (var j = 1, l = node.childNodes.length; j < l; j++) {
	node.childNodes[j].style.display = 'none';
	node.childNodes[j].setAttribute('data-rm', '1');
      }
      node.appendChild(fragment);
      self.loading = false;
      if (self.nextChunk) {
	// If there is another chunk queued to be rendered, render that now.
	self._renderChunk(self.nextChunk.node, self.nextChunk.from);
      }
    });
  }
};

VirtualList.prototype.updateTotalRows = function(totalRows) {
  this.totalRows = totalRows
  this.scroller.style.height = (this.itemHeight * this.totalRows) + 'px';
};

VirtualList.createContainer = function(w, h) {
  var c = document.createElement('div');
  c.style.width = w;
  c.style.height = h;
  c.style.overflow = 'auto';
  c.style.position = 'relative';
  c.style.padding = 0;
  c.style.border = '1px solid black';
  return c;
};

VirtualList.createScroller = function(h) {
  var scroller = document.createElement('div');
  scroller.style.opacity = 0;
  scroller.style.position = 'absolute';
  scroller.style.top = 0;
  scroller.style.left = 0;
  scroller.style.width = '1px';
  scroller.style.height = h + 'px';
  return scroller;
};
