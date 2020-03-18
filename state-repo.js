/**
 * Represents a State, that can be written to by a StateWriter, and read by StateReaders.
 *
 * <p>
 * Has 4 Properties:
 * <p>
 * id: Any, a unique identifier for this State, for example a String
 * <p>
 * value: Any, undefined until a writer sets
 * <p>
 * writer: StateWriter
 * <p>
 * readers: Set of StateReaders
 */
class State {
	/**
	 * @param id: Any the State's identifier. Strings are recommended
	 */
	constructor(id) {
		this.id = id;
		this.readers = new Set();
	}
}

/**
 * Reads a State; its changeListener is fired when the State changes.
 */
class StateReader {
	/**
	 * @param state: State
	 * @param changeListener: (newValue, StateReader) => Void
	 */
	constructor(state, changeListener) {
		this._state = state;
		this._changeListener = changeListener;
		this._registered = true;
	}

	/**
	 * Returns the State's identifier.
	 */
	get id() {
		return this._state.id;
	}

	/**
	 * Gets the current value. Must not be modified.
	 * Will return undefined until value is set.
	 * This method should not be regularly called.
	 */
	get value() {
		return this._state.value;
	}

	/**
	 * true if the StateReader is registered for updates,
	 * false otherwise.
	 */
	get registered() {
		return this._registered;
	}

	/**
	 * Registers this StateReader for State updates.
	 * Returns true if registration succeeded,
	 * false if already registered
	 */
	register() {
		if (this._registered) return false;
		this._state.readers.add(this);
		this._registered = true;
		return true;
	}

	/**
	 * Unregisters this StateReader from State updates.
	 * Returns true if unregistration succeeded,
	 * false if already unregistered.
	 */
	unregister() {
		if (!this._registered) return false;
		this._state.readers.delete(this);
		this._registered = false;
		return true;
	}
}

/**
 * Writes to a State, firing the State's registered changeListeners when
 * set(newVal) is called.
 */
class StateWriter {
	/**
	 * @param state: State
	 * @param repo: StateRepo owning this StateWriter
	 */
	constructor(state, repo) {
		this._state = state;
		this._repo = repo;
		this._registered = true;
	}

	/**
	 * Returns the State's identifier
	 */
	get id() {
		return this._state.id;
	}

	/**
	 * Gets the current value. Returned object should not be
	 * modified, unless set(state) is called afterwards.
	 * Will return undefined until value is set.
	 */
	get value() {
		return this._state.value;
	}

	/**
	 * true if the StateWriter is registered for updates,
	 * false otherwise.
	 */
	get registered() {
		return this._registered;
	}

	/**
	 * Unregisters this object as the Writer to its State.
	 * To update the State again, you need to create a fresh StateWriter object.
	 *
	 * @return true if unregistration was successful, false if already unregistered
	 */
	unregister() {
		if (!this._registered) return false;
		delete this._state.writer;
		this._registered = false;
		return true;
	}

	/**
	 * Set the State's value, notifying all registered StateReaders.
	 *
	 * @param v: Any | oldVal => newVal. Either a new value, or function from old to new.
	 * Remember that oldVal may be initially undefined.
	 * @return Void
	 */
	set(v) {
		const newValue = typeof v === 'function' ? v(this._state.value) : v;
		this._state.value = newValue;
		for (let r of this._state.readers) r._changeListener(newValue, r);
	}
}

/**
 * A repository of States, with methods to create StateReaders and StateWriters.
 */
export class StateRepo {
	constructor() {
		this._map = new Map();
	}

	/**
	 * Returns a new StateReader
	 * @param id: Any, a unique identifier, like the String 'state1'
	 * @param changeListener: (newVal, StateReader) => Void, fired when the State is updated
	 */
	reader(id, changeListener) {
		let state = this._map.get(id);
		if (!state) this._map.set(id, (state = new State(id)));
		const reader = new StateReader(state, changeListener);
		state.readers.add(reader);
		// fire listener if the State already has a value.
		if (state.value) changeListener(state.value, reader);
		return reader;
	}

	/**
	 * Returns a new StateWriter for this id, otherwise throws exception
	 * @param id: Any, a unique identifier, like the String 'state1'
	 * @param initialValue: Any, may be undefined. Only set if the State
	 * for id does not already exist.
	 */
	writer(id, initialValue) {
		let state = this._map.get(id);
		if (!state) this._map.set(id, (state = new State(id)));
		else if (state.writer) throw 'Writer already exists for ' + id;
		const writer = new StateWriter(state, this);
		state.writer = writer;
		if (initialValue) writer.set(initialValue);
		return writer;
	}
}

/**
 * The default StateRepo
 */
export const repo = new StateRepo();
