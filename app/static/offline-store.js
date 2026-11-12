(function () {
  const DATABASE_NAME = "savestock-offline-v1";
  const STORE_NAME = "vault";
  const ITERATIONS = 600000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let key = null;
  let state = null;
  let writeChain = Promise.resolve();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function serializeWrite(action) {
    const result = writeChain.then(action);
    writeChain = result.catch(function () {});
    return result;
  }

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = function () {
        request.result.createObjectStore(STORE_NAME, {keyPath: "id"});
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Yerel kasa açılamadı.")); };
    });
  }

  async function readRecord() {
    const database = await openDatabase();
    return new Promise(function (resolve, reject) {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get("vault");
      request.onsuccess = function () { resolve(request.result || null); };
      request.onerror = function () { reject(request.error || new Error("Yerel kasa okunamadı.")); };
      transaction.oncomplete = function () { database.close(); };
      transaction.onerror = function () { database.close(); };
    });
  }

  async function writeRecord(record) {
    const database = await openDatabase();
    return new Promise(function (resolve, reject) {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = function () { database.close(); resolve(); };
      transaction.onerror = function () {
        database.close();
        reject(transaction.error || new Error("Yerel kasa kaydedilemedi."));
      };
      transaction.onabort = function () {
        database.close();
        reject(transaction.error || new Error("Yerel kasa kaydedilemedi."));
      };
    });
  }

  async function deriveKey(pin, salt) {
    const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      {name: "PBKDF2", salt: salt, iterations: ITERATIONS, hash: "SHA-256"},
      material,
      {name: "AES-GCM", length: 256},
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function save() {
    if (!key || !state) throw new Error("Önce çevrimdışı kasanın kilidini açın.");
    const activeKey = key;
    const serializedState = JSON.stringify(state);
    const record = await readRecord();
    if (!record) throw new Error("Çevrimdışı kasa bulunamadı.");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      {name: "AES-GCM", iv: iv},
      activeKey,
      encoder.encode(serializedState)
    );
    await writeRecord({id: "vault", salt: record.salt, iv: iv, ciphertext: ciphertext});
  }

  async function setup(pin, snapshot) {
    if (typeof pin !== "string" || pin.length < 8) throw new Error("Çevrimdışı PIN en az 8 karakter olmalı.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    try {
      key = await deriveKey(pin, salt);
      state = {version: 1, user: snapshot.user, cache: snapshot.cache, queue: []};
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        {name: "AES-GCM", iv: iv},
        key,
        encoder.encode(JSON.stringify(state))
      );
      await writeRecord({id: "vault", salt: salt, iv: iv, ciphertext: ciphertext});
    } catch (error) {
      key = null;
      state = null;
      throw error;
    }
  }

  async function unlock(pin) {
    const record = await readRecord();
    if (!record) throw new Error("Bu cihazda çevrimdışı kasa ayarlanmamış.");
    try {
      key = await deriveKey(pin, record.salt);
      const plaintext = await crypto.subtle.decrypt(
        {name: "AES-GCM", iv: record.iv},
        key,
        record.ciphertext
      );
      state = JSON.parse(decoder.decode(plaintext));
      if (!state || state.version !== 1 || !state.user || !state.cache || !Array.isArray(state.queue)) {
        throw new Error("Çevrimdışı kasa biçimi geçersiz.");
      }
      return clone(state);
    } catch (error) {
      key = null;
      state = null;
      if (error && error.message === "Çevrimdışı kasa biçimi geçersiz.") throw error;
      throw new Error("PIN doğrulanamadı veya çevrimdışı kasa okunamadı.");
    }
  }

  async function hasVault() {
    return Boolean(await readRecord());
  }

  async function updateSnapshot(user, cache) {
    if (!state || !key) return false;
    if (String(state.user.id) !== String(user.id)) return false;
    return serializeWrite(async function () {
      if (!state || !key || String(state.user.id) !== String(user.id)) return false;
      const activeKey = key;
      const workingState = state;
      const previous = clone(state);
      state.user = user;
      state.cache = cache;
      try {
        await save();
        return true;
      } catch (error) {
        if (key === activeKey && state === workingState) state = previous;
        throw error;
      }
    });
  }

  async function addOperation(operation) {
    if (!state || !key) throw new Error("Çevrimdışı kasa kilitli. Önce PIN ile açın.");
    return serializeWrite(async function () {
      if (!state || !key) throw new Error("Çevrimdışı kasa kilitli. Önce PIN ile açın.");
      const activeKey = key;
      const workingState = state;
      const previous = clone(state);
      state.queue.push(operation);
      try {
        await save();
        return clone(state.queue);
      } catch (error) {
        if (key === activeKey && state === workingState) state = previous;
        throw error;
      }
    });
  }

  async function updateOperation(id, changes) {
    if (!state || !key) throw new Error("Çevrimdışı kasa kilitli.");
    return serializeWrite(async function () {
      if (!state || !key) throw new Error("Çevrimdışı kasa kilitli.");
      const activeKey = key;
      const workingState = state;
      const previous = clone(state);
      const operation = state.queue.find(function (item) { return item.id === id; });
      if (!operation) return clone(state.queue);
      Object.assign(operation, changes);
      try {
        await save();
        return clone(state.queue);
      } catch (error) {
        if (key === activeKey && state === workingState) state = previous;
        throw error;
      }
    });
  }

  async function removeOperation(id) {
    if (!state || !key) throw new Error("Çevrimdışı kasa kilitli.");
    return serializeWrite(async function () {
      if (!state || !key) throw new Error("Çevrimdışı kasa kilitli.");
      const activeKey = key;
      const workingState = state;
      const previous = clone(state);
      state.queue = state.queue.filter(function (item) { return item.id !== id; });
      try {
        await save();
        return clone(state.queue);
      } catch (error) {
        if (key === activeKey && state === workingState) state = previous;
        throw error;
      }
    });
  }

  async function clearQueue() {
    if (!state || !key) throw new Error("Çevrimdışı kasa kilitli.");
    return serializeWrite(async function () {
      if (!state || !key) throw new Error("Çevrimdışı kasa kilitli.");
      const activeKey = key;
      const workingState = state;
      const previous = clone(state);
      state.queue = [];
      try {
        await save();
        return [];
      } catch (error) {
        if (key === activeKey && state === workingState) state = previous;
        throw error;
      }
    });
  }

  async function clear() {
    return serializeWrite(async function () {
      const database = await openDatabase();
      await new Promise(function (resolve, reject) {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).clear();
        transaction.oncomplete = function () { database.close(); resolve(); };
        transaction.onerror = function () {
          database.close();
          reject(transaction.error || new Error("Çevrimdışı veriler silinemedi."));
        };
        transaction.onabort = function () {
          database.close();
          reject(transaction.error || new Error("Çevrimdışı veriler silinemedi."));
        };
      });
      key = null;
      state = null;
    });
  }

  window.SaveStockOfflineStore = {
    addOperation: addOperation,
    clearQueue: clearQueue,
    clear: clear,
    hasVault: hasVault,
    isUnlocked: function () { return Boolean(key && state); },
    lock: function () { key = null; state = null; },
    removeOperation: removeOperation,
    setup: setup,
    state: function () { return key && state ? clone(state) : null; },
    unlock: unlock,
    updateOperation: updateOperation,
    updateSnapshot: updateSnapshot
  };
})();
