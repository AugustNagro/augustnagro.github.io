/**
 * Represents a State, that can be written to by at most one a StateWriter,
 * and read by StateReaders.
 *
 * @template T
 */
class State {
	/**
	 * @param {*} id A unique identifier for this State. Strings are recommended.
	 */
	constructor(id) {
		/** 
		 * A unique identifier for this State. Strings are recommended.
		 *
		 * @private @const {*}
		 */
		this.id = id;

		/**
		 * The State's value. Undefined until a writer sets.
		 *
		 * @private {T}
		 */
		this.value = undefined;

		/** @private {!StateWriter|undefined} */
		this.writer = undefined;

		/** @private @const {!Set<!StateReader>} */
		this.readers = new Set();
	}
}

/**
 * Reads a State; its changeListener is fired when the State changes.
 *
 * @template T
 */
class StateReader {
	/**
	 * @param {!State} state
	 * @param {function(T, !StateReader)} changeListener
	 */
	constructor(state, changeListener) {
		/** @private @const {!State} */
		this._state = state;

		/** @private @const {function(T, !StateReader)} */
		this._changeListener = changeListener;

		/** @private {boolean} */
		this._registered = true;
	}

	/**
	 * Returns the State's identifier.
	 *
	 * @return {*}
	 */
	id() {
		return this._state.id;
	}

	/**
	 * Gets the current value. Must not be modified.
	 * Will return undefined until value is set.
	 * This method should not be regularly called.
	 *
	 * @return {T}
	 */
	value() {
		return this._state.value;
	}

	/**
	 * true if the StateReader is registered for updates,
	 * false otherwise.
	 *
	 * @return {boolean}
	 */
	registered() {
		return this._registered;
	}

	/**
	 * Registers this StateReader for State updates.
	 * Returns true if registration succeeded,
	 * false if already registered
	 *
	 * @return {boolean}
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
	 *
	 * @return {boolean}
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
 *
 * @template T
 */
class StateWriter {
	/**
	 * @param {!State} state
	 * @param {!StateRepo} repo
	 */
	constructor(state, repo) {
		/** @private @const {!State} */
		this._state = state;

		/** @private @const {!StateRepo} */
		this._repo = repo;

		/** @private {boolean} */
		this._registered = true;
	}

	/**
	 * Returns the State's identifier
	 *
	 * @return {*}
	 */
	id() {
		return this._state.id;
	}

	/**
	 * Gets the current value. Returned object should not be
	 * modified, unless set(state) is called afterwards.
	 * Will return undefined until value is set.
	 *
	 * @return {T}
	 */
	value() {
		return this._state.value;
	}

	/**
	 * Directly sets this StateWriter's value, notifying all registered StateReaders.
	 *
	 * @param {T} newValue
	 */
	setValue(newValue) {
		this._state.value = newValue;
		for (let r of this._state.readers) {
			r._changeListener(newValue, r);
		}
	}

	/**
	 * Set the StateWriter's value, notifying all registered StateReaders.
	 *
	 * @param {function(T): T} f Function accepting the old value, and returning the new.
	 * Remember that the old value may be initially undefined.
	 */
	set(f) {
		const newValue = f(this._state.value);
		this._state.value = newValue;
		for (let r of this._state.readers) {
			r._changeListener(newValue, r);
		}
	}

	/**
	 * true if the StateWriter is registered for updates,
	 * false otherwise.
	 *
	 * @return {boolean}
	 */
	registered() {
		return this._registered;
	}

	/**
	 * Unregisters this object as the Writer to its State.
	 * To update the State again, you need to create a fresh StateWriter object.
	 *
	 * @return {boolean} true if unregistration was successful, false if already unregistered
	 */
	unregister() {
		if (!this._registered) return false;
		this._state.writer = undefined;
		this._registered = false;
		return true;
	}
}

/**
 * A repository of States, with methods to create StateReaders and StateWriters.
 */
export class StateRepo {
	constructor() {
		/** @private @const {!Map<*, !State>} */
		this._map = new Map();
	}

	/**
	 * Returns a new StateReader
	 *
	 * @template T
	 * @param {*} id A unique identifier, such as a String
	 * @param {function(T, !StateReader<T>): T} changeListener fired when State is updated
	 * @return {!StateReader<T>}
	 */
	reader(id, changeListener) {
		let state = this._map.get(id);
		if (!state) {
			state = new State(id);
			this._map.set(id, state);
		}
		const reader = new StateReader(state, changeListener);
		state.readers.add(reader);
		// fire listener if the State already has a value.
		if (state.value !== undefined) changeListener(state.value, reader);
		return reader;
	}

	/**
	 * Returns a new StateWriter for this id, otherwise throws exception
	 *
	 * @template T
	 * @param {*} id A unique identifier, such as a String
	 * @param {T=} initialValue Optional. Only set if the State
	 * for id does not already exist.
	 * @return {StateWriter<T>}
	 */
	writer(id, initialValue = undefined) {
		let state = this._map.get(id);
		if (!state) {
			state = new State(id);
			this._map.set(id, state);
		} else if (state.writer) {
			throw new Error('Writer already exists for ' + id);
		}
		const writer = new StateWriter(state, this);
		state.writer = writer;
		if (initialValue !== undefined) writer.setValue(initialValue);
		return writer;
	}
}

/**
 * The default StateRepo
 *
 * @public @const
 */
export const repo = new StateRepo();
