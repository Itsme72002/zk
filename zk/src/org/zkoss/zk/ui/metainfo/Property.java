/* Property.java

{{IS_NOTE
	Purpose:
		
	Description:
		
	History:
		Sun Apr 16 14:55:35     2006, Created by tomyeh
}}IS_NOTE

Copyright (C) 2006 Potix Corporation. All Rights Reserved.

{{IS_RIGHT
	This program is distributed under GPL Version 2.0 in the hope that
	it will be useful, but WITHOUT ANY WARRANTY.
}}IS_RIGHT
*/
package org.zkoss.zk.ui.metainfo;

import java.lang.reflect.Method;
import java.io.Serializable;

import org.zkoss.lang.Classes;
import org.zkoss.lang.Exceptions;
import org.zkoss.util.logging.Log;

import org.zkoss.zk.ui.Component;
import org.zkoss.zk.ui.Page;
import org.zkoss.zk.ui.UiException;
import org.zkoss.zk.ui.util.Condition;
import org.zkoss.zk.ui.ext.DynamicPropertied;
import org.zkoss.zk.ui.xel.Evaluator;
import org.zkoss.zk.ui.xel.ExValue;

/**
 * Info about how to initialize a property (aka., a field of a component).
 *
 * @author tomyeh
 */
public class Property implements Condition, Serializable {
	private static final Log log = Log.lookup(Property.class);
    private static final long serialVersionUID = 20060622L;

	private final String _name;
	private final ExValue _value;
	private final Condition _cond;
	/** Used to optimize {@link #resolve}. */
	private transient Class _lastcls;
	/** The method, or null if more than two methods are found
	 * (and use {@link #_mtds} in this case).
	 */
	private transient Method _mtd;
	/** Used more than two methods are found, or null if only one method
	 * (and use {@link #_mtd} in this case).
	 */
	private transient Method[] _mtds;

	/** Constructs a property with a class that is known in advance.
	 */
	public Property(String name, String value, Condition cond) {
		if (name == null)
			throw new IllegalArgumentException();
		_name = name;
		_cond = cond;
		_value = new ExValue(value, Object.class);
			//type will be fixed when mapped to a method
	}

	/** Returns the name of the property.
	 */
	public String getName() {
		return _name;
	}
	/** Returns the raw value of the property.
	 * Note: it is the original value without evaluation.
	 * In other words, it may contain EL expressions.
	 * @since 3.0.0
	 */
	public String getRawValue() {
		return _value.getRawValue();
	}
	/** Sets the raw value of the property.
	 * @since 3.0.0
	 */
	public void setRawValue(String value) {
		_value.setRawValue(value);
	}
	/** Returns the condition.
	 */
	public Condition getCondition() {
		return _cond;
	}

	/** Resolves the method. */
	private final void resolve(Evaluator eval, Class cls) {
		final String mtdnm = Classes.toMethodName(_name, "set");
		if (_value.isExpression()) {
			_mtds = Classes.getCloseMethods(cls, mtdnm, new Class[] {null});
			if (_mtds.length == 0) {
				if (!DynamicPropertied.class.isAssignableFrom(cls))
					throw new UiException("Method "+mtdnm+" not found for "+cls); 
				_mtds = null;
			} else if (_mtds.length == 1) {
				_mtd = _mtds[0];
				_mtds = null;
			}
		} else {
		//Note: String has higher priority
			try {
				_mtd = Classes.getCloseMethod(
					cls, mtdnm, new Class[] {String.class});
			} catch (NoSuchMethodException ex) {
				try {
					_mtd = Classes.getCloseMethod(
						cls, mtdnm, new Class[] {null});
				} catch (NoSuchMethodException e2) {
					if (!DynamicPropertied.class.isAssignableFrom(cls))
						throw new UiException("Method not found: "+mtdnm);
					_mtd = null;
				}
			}
		}
	}

	/** Evaluates the value to an Object.
	 * Note: it does NOT call {@link #isEffective} and it doesn't coerce
	 * the result (i.e., Object.class is assumed).
	 */
	public Object getValue(Evaluator eval, Component comp) {
		return _value.getValue(eval, comp);
	}
	/** Evaluates the value to an Object.
	 * Note: it does NOT call {@link #isEffective} and it doesn't coerce
	 * the result (i.e., Object.class is assumed).
	 */
	public Object getValue(Evaluator eval, Page page) {
		return _value.getValue(eval, page);
	}
	/** Assigns the value of this memeber to the specified component.
	 *
	 * <p>Note: this method does nothing if {@link #isEffective} returns false.
	 */
	public void assign(Evaluator eval, Component comp) {
		if (!isEffective(comp))
			return; //ignored

		try {
			final Class cls = comp.getClass();
			if (_lastcls != cls) {
				resolve(eval, cls);
				_lastcls = cls;
			}

			//Note: if _mtd and _mtds are both null, it must be dyna-attr
			//However, if dyna-attr, _mtd or _mtds might not be null
			final Class type =
				_mtd != null ? _mtd.getParameterTypes()[0]: Object.class;
			_value.setExpectedType(type);
			Object val = _value.getValue(eval, comp);

			final Method mtd;
			if (_mtd != null) {
				mtd = _mtd;
			} else if (_mtds == null) {
				//it must be dynamic attribute
				((DynamicPropertied)comp).setDynamicProperty(_name, val);
				return; //done
			} else if (val == null) { //_mtds != null but val == null
				mtd = _mtds[0];
				val = Classes.coerce(mtd.getParameterTypes()[0], val);
			} else { //_mtds != null && val != null
				for (int j = 0; ; ++j) {
					if (j == _mtds.length) {
						mtd = _mtds[0];
						val = Classes.coerce(mtd.getParameterTypes()[0], val);
						break; //pick randomly
					}
					if (_mtds[j].getParameterTypes()[0].isInstance(val)) {
						mtd = _mtds[j];
						break; //found
					}
				}
			}

			mtd.invoke(comp, new Object[] {val});
		} catch (Exception ex) {
			log.error("Failed to assign "+this+" to "+comp+"\n"+Exceptions.getMessage(ex));
			throw UiException.Aide.wrap(ex);
		}
	}

	public boolean isEffective(Component comp) {
		return _cond == null || _cond.isEffective(comp);
	}
	public boolean isEffective(Page page) {
		return _cond == null || _cond.isEffective(page);
	}
	public String toString() {
		return "["+_name+"="+_value+']';
	}
}
