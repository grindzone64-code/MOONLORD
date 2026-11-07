import threading


class TaskStore:
    def __init__(self):
        self._tasks = {}
        self._lock = threading.Lock()

    def create(self, taskid):
        with self._lock:
            self._tasks[taskid] = {
                "status": "not_ready",
                "uuid": None,
                "token": None,
                "cookies": {},
            }

    def set_result(self, taskid, status, uuid=None, cookies=None):
        with self._lock:
            if taskid not in self._tasks:
                return
            self._tasks[taskid]["status"] = status
            self._tasks[taskid]["uuid"] = uuid
            self._tasks[taskid]["token"] = uuid
            self._tasks[taskid]["cookies"] = cookies or {}

    def get(self, taskid):
        with self._lock:
            return self._tasks.get(
                taskid,
                {"status": "not_found", "uuid": None, "cookies": {}},
            )
