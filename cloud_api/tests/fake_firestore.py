"""A minimal in-memory stand-in for the bits of Firestore StatsStore uses.

Only what stats.py actually calls: a filtered stream over a collection, a
write batch, and get_all(). Small enough to read in one sitting, which is
the point -- the alternative is mocking the client method-by-method and
asserting on call shapes rather than on the data that comes out.
"""


class FakeSnapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class FakeRef:
    def __init__(self, collection, doc_id):
        self._collection = collection
        self.id = doc_id

    @property
    def path(self):
        return f"{self._collection.name}/{self.id}"

    def get(self):
        return FakeSnapshot(self.id, self._collection.docs.get(self.id))


_OPS = {
    '==': lambda actual, expected: actual == expected,
    '>=': lambda actual, expected: actual >= expected,
    '<': lambda actual, expected: actual < expected,
}


class FakeQuery:
    def __init__(self, collection, filters=()):
        self._collection = collection
        self._filters = tuple(filters)

    def where(self, field, op, value):
        return FakeQuery(self._collection, self._filters + ((field, op, value),))

    def _matches(self, data):
        for field, op, value in self._filters:
            actual = data.get(field)
            if actual is None:
                return False
            if not _OPS[op](actual, value):
                return False
        return True

    def stream(self):
        for doc_id, data in sorted(self._collection.docs.items()):
            if self._matches(data):
                yield FakeSnapshot(doc_id, data)


class FakeCollection:
    def __init__(self, name):
        self.name = name
        self.docs = {}

    def document(self, doc_id):
        return FakeRef(self, doc_id)

    def where(self, field, op, value):
        return FakeQuery(self).where(field, op, value)


class FakeBatch:
    def __init__(self, client):
        self._client = client
        self._writes = []

    def set(self, ref, data):
        self._writes.append((ref, data))

    def commit(self):
        for ref, data in self._writes:
            self._client.collections[ref.path.split('/')[0]].docs[ref.id] = data
        self._writes = []
        self._client.commits += 1


class FakeClient:
    def __init__(self):
        self.collections = {}
        self.commits = 0

    def collection(self, name):
        return self.collections.setdefault(name, FakeCollection(name))

    def batch(self):
        return FakeBatch(self)

    def get_all(self, refs):
        # Deliberately reversed: the real get_all makes no ordering
        # promise, and code that quietly relies on one must fail here.
        for ref in reversed(list(refs)):
            yield ref.get()

    def seed(self, collection, doc_id, data):
        self.collection(collection).docs[doc_id] = data
