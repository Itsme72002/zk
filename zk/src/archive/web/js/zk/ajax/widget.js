/* widget.js

{{IS_NOTE
	Purpose:
		Widget - the UI object at the client
	Description:
		
	History:
		Tue Sep 30 09:23:56     2008, Created by tomyeh
}}IS_NOTE

Copyright (C) 2008 Potix Corporation. All Rights Reserved.

{{IS_RIGHT
	This program is distributed under GPL Version 2.0 in the hope that
	it will be useful, but WITHOUT ANY WARRANTY.
}}IS_RIGHT
*/
zk.Widget = zk.$extends(zk.Object, {
	/** The UUID (readonly if inServer). */
	//uuid: null,
	/** The next sibling (readonly). */
	//nextSibling: null,
	/** The previous sibling widget (readonly). */
	//previousSibling: null,
	/** The parent (readonly).
	 */
	//parent: null,
	/** The first child widget (readonly). */
	//firstChild: null,
	/** The last child widget (readonly). */
	//lastChild: null,
	/** The page that this widget belongs to (readonly). */
	//page: null,

	/** Whether this widget has a copy at the server (readonly). */
	//inServer: false,

	/** Constructor. */
	$init: function (uuid, mold) {
		this.uuid = uuid ? uuid: zk.Widget.nextUuid();
		this.mold = mold ? mold: "default";
	},
	/** Generates the HTML content. */
	redraw: function () {
		var s = this.$class.molds[this.mold].call(this);
		return this.prolog ? this.prolog + s: s;
	},
	/** Appends a child widget.
	 */
	appendChild: function (child) {
		if (child == this.lastChild)
			return;

		if (child.parent)
			child.parent.removeChild(child);

		child.parent = this;
		var p = this.lastChild;
		if (p) {
			p.nextSibling = child;
			child.previousSibling = p;
			this.lastChild = child;
		} else {
			this.firstChild = this.lastChild = child;
		}

		//TODO: if parent belongs to DOM
	},
	/** Inserts a child widget before the specified one.
	 */
	insertBefore: function (child, sibling) {
		if (!sibling || sibling.parent != this) {
			this.appendChild(child);
			return;
		}

		if (child == sibling || child.nextSibling == sibling)
			return;

		if (child.parent)
			child.parent.removeChild(child);

		var p = sibling.previousSibling;
		if (p) {
			child.previousSibling = p;
			p.nextSibling = child;
		} else this.firstChild = child;

		sibling.previousSibling = child;
		child.nextSibling = sibling;

		child.desktop = this.desktop;

		//TODO: if parent belongs to DOM
	},
	/** Removes the specified child.
	 */
	removeChild: function (child) {
		if (!child.parent)
			return;
		if (this != child.parent)
			throw "Not a child: "+child;

		var p = child.previousSibling, n = child.nextSibling;
		if (p) p.nextSibling = n;
		else this.firstChild = n;
		if (n) n.previousSibling = p;
		else this.lastChild = p;
		child.nextSibling = child.previousSibling = child.parent = null;

		child.desktop = null;

		//TODO: if parent belongs to DOM
	},

	/** Attaches the widget to the DOM tree.
	 * @param id the DOM element's ID.
	 */
	attach: function (id, options) {
		zk.debug("attach", this.uuid, id);
	},

	//ZK event//
	/** An array of important events. An import event is an event
	 * that must be sent to the server even without event listener.
	 * It is usually about state-updating, such as onChange and onSelect.
	 * <p>Default: null if no event at all.
	 */
	//importantEvents: null,
	/** Fires a Widget event.
	 * Note: the event will be sent to the server if it is in server
	 * (@{link #inServer}), and belongs to a desktop.
	 */
	fire: function (evt, timeout) {
		evt.target = this;
		if (this.inServer && this.desktop) {
			var ies = this.importantEvents,
				evtnm = evt.name;
			if (this[evtnm] != zk.undefined
			|| (ies != null && ies.contains(evtnm)))
				zAu.send(evt, timeout);
		}
	}
}, {
	/** Returns the widget of the specified ID, or null if not found,
	 * or the widget is attached to the DOM tree.
	 * <p>Note: null is returned if the widget is not attached to the DOM tree
	 * (i.e., not associated with an DOM element).
	 */
	$: function (uuid) {
		//No map from uuid to widget directly. rather, go thru DOM
		var n = zDom.$(uuid);
		return n ? n.z_wgt: null;
	},

	/** Returns the next unquie widget UUID.
	 */
	nextUuid: function () {
		return "_z_" + this._nextUuid++;
	},
	_nextUuid: 0
});

/** A ZK desktop. */
zk.Desktop = zk.$extends(zk.Object, {
	/** The type (always "#d")(readonly). */
	type: "#d",
	/** The AU request that shall be sent. Used by au.js */
	_aureqs: [],

	$init: function (dtid, updateURI) {
		var zdt = zk.Desktop, dt = zdt.all[dtid];
		if (!dt) {
			this.id = dtid;
			this.updateURI = updateURI;
			zdt.all[dtid] = this;
			if (!zdt._dt) zdt._dt = this; //default desktop
		} else if (updateURI)
			dt.updateURI = updateURI;

		zdt.cleanup();
	}
},{
	/** Returns the desktop of the specified ID.
	 */
	$: function (dtid) {
		return dtid ? typeof dtid == 'string' ?
			zk.Desktop.all[dtid]: dtid: zk.Desktop._dt;
	},
	/** A map of (String dtid, zk.Desktop dt) (readonly). */
	all: {},
	/** Remove desktops that are no longer valid.
	 */
	cleanup: function () {
		var zdt = zk.Desktop, dts = zdt.all;
		if (zdt._dt && zdt._dt.pgid && !zDom.$(zdt._dt.pgid)) //removed
			zdt._dt = null;
		for (var dtid in dts) {
			var dt = dts[dtid];
			if (dt.pgid && !zDom.$(dt.pgid)) //removed
				delete dts[dtid];
			else if (!zdt._dt)
				zdt._dt = dt;
		}
	}
});

/** A ZK page. */
zk.Page = zk.$extends(zk.Widget, {//unlik server, we derive from Widget!
	/** The type (always "#p")(readonly). */
	type: "#p",
	/** The style (readonly). */
	style: "width:100%;height:100%",
	$init: function (pgid, contained) {
		this.uuid = pgid;
		this.node = zDom.$(pgid); //might null
		if (contained)
			zk.Page.contained.add(this, true);
	},
	redraw: function () {
		var html = '<div id="' + this.uuid + '" style="' + this.style + '">';
		for (var w = this.firstChild; w; w = w.nextSibling)
			html += w.redraw();
		return html + '</div>';
	}

},{
	/** An list of contained page (i.e., standalone but not covering
	 * the whole browser window.
	 */
	contained: []
});

/** A widget event, fired by {@link zk.Widget#fire}.
 * It is an application-level event that is used by application to
 * hook the listeners to.
 * On the other hand, a DOM event ({@link zEvt}) is the low-level event
 * listened by the implementation of a widget.
 */
zk.Event = zk.$extends(zk.Object, {
	/** The target widget. */
	//target: null,
	/** The event name. */
	//name: null,
	/** The extra data, which could be anything. */
	//data: null,
	/** Whether this event is an implicit event, i.e., whether it is implicit
	 * to users (so no progressing bar).
	 */
	//implicit: false,
	/** Whether this event is ignorable, i.e., whether to ignore any error
	 * of sending this event back the server.
	 * An ignorable event is also an imiplicit event
	 */
	//ignorable: false

	$init: function (target, name, data) {
		this.target = target;
		this.name = name;
		this.data = data ? data: null;
	}
});
