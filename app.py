"""Run StudySprint with Python: python app.py (opens http://localhost:5000)."""

import json
import mimetypes
import os
import threading
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


PROJECT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = PROJECT_DIR / "public"
TASKS_FILE = PROJECT_DIR / "server" / "tasks.json"
PORT = int(os.environ.get("PORT", "5000"))
TASK_LOCK = threading.Lock()
CATEGORIES = {
    "Assignment",
    "Lab Work",
    "Project",
    "Exam Preparation",
    "Seminar",
    "Placement",
    "Internship",
    "Other",
}
PRIORITIES = {"High", "Medium", "Low"}


def create_sample_tasks():
    created_at = datetime.now(timezone.utc).isoformat()
    samples = [
        ("Complete Data Structures Assignment", "Assignment", "High"),
        ("Prepare C++ Lab Exam", "Exam Preparation", "High"),
        ("Submit Machine Learning Record", "Lab Work", "Medium"),
        ("Complete Web Development Project", "Project", "High"),
        ("Prepare Seminar Presentation", "Seminar", "Medium"),
        ("Practice Placement Aptitude", "Placement", "Low"),
    ]
    return [
        {
            "id": str(uuid.uuid4()),
            "title": title,
            "category": category,
            "priority": priority,
            "completed": False,
            "createdAt": created_at,
        }
        for title, category, priority in samples
    ]


def read_tasks():
    if not TASKS_FILE.exists():
        tasks = create_sample_tasks()
        write_tasks(tasks)
        return tasks
    return json.loads(TASKS_FILE.read_text(encoding="utf-8"))


def write_tasks(tasks):
    TASKS_FILE.write_text(json.dumps(tasks, indent=2) + "\n", encoding="utf-8")


class StudySprintHandler(BaseHTTPRequestHandler):
    def send_json(self, status, data=None):
        body = b"" if data is None else json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 16_384:
            raise ValueError("Request body is too large.")
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        request_path = urlsplit(self.path).path
        if request_path == "/api/tasks":
            try:
                with TASK_LOCK:
                    self.send_json(200, read_tasks())
            except (OSError, json.JSONDecodeError) as error:
                self.send_json(500, {"message": f"Could not read tasks: {error}"})
            return

        relative_path = "index.html" if request_path == "/" else unquote(request_path).lstrip("/")
        file_path = (PUBLIC_DIR / relative_path).resolve()
        if not file_path.is_relative_to(PUBLIC_DIR) or not file_path.is_file():
            self.send_error(404, "File not found")
            return

        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlsplit(self.path).path != "/api/tasks":
            self.send_json(404, {"message": "Route not found."})
            return

        try:
            data = self.read_json_body()
            raw_title = data.get("title") if isinstance(data, dict) else None
            title = raw_title.strip() if isinstance(raw_title, str) else ""
            category = data.get("category") if isinstance(data, dict) else None
            priority = data.get("priority") if isinstance(data, dict) else None
            if not title or len(title) > 160:
                self.send_json(400, {"message": "Enter a task name up to 160 characters."})
                return
            if not isinstance(category, str) or category not in CATEGORIES:
                self.send_json(400, {"message": "Choose a valid task category."})
                return
            if not isinstance(priority, str) or priority not in PRIORITIES:
                self.send_json(400, {"message": "Choose a valid task priority."})
                return

            task = {
                "id": str(uuid.uuid4()),
                "title": title,
                "category": category,
                "priority": priority,
                "completed": False,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            with TASK_LOCK:
                tasks = read_tasks()
                tasks.insert(0, task)
                write_tasks(tasks)
            self.send_json(201, task)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"message": str(error) or "Send valid JSON."})
        except OSError as error:
            self.send_json(500, {"message": f"Could not save task: {error}"})

    def do_PUT(self):
        task_id = self.task_id_from_path()
        if task_id is None:
            self.send_json(404, {"message": "Route not found."})
            return

        try:
            with TASK_LOCK:
                tasks = read_tasks()
                task = next((item for item in tasks if item["id"] == task_id), None)
                if task is None:
                    self.send_json(404, {"message": "Task not found."})
                    return
                task["completed"] = True
                write_tasks(tasks)
            self.send_json(200, task)
        except (OSError, json.JSONDecodeError) as error:
            self.send_json(500, {"message": f"Could not update task: {error}"})

    def do_DELETE(self):
        task_id = self.task_id_from_path()
        if task_id is None:
            self.send_json(404, {"message": "Route not found."})
            return

        try:
            with TASK_LOCK:
                tasks = read_tasks()
                remaining = [task for task in tasks if task["id"] != task_id]
                if len(remaining) == len(tasks):
                    self.send_json(404, {"message": "Task not found."})
                    return
                write_tasks(remaining)
            self.send_response(204)
            self.end_headers()
        except (OSError, json.JSONDecodeError) as error:
            self.send_json(500, {"message": f"Could not delete task: {error}"})

    def task_id_from_path(self):
        parts = urlsplit(self.path).path.strip("/").split("/")
        if len(parts) == 3 and parts[:2] == ["api", "tasks"]:
            return unquote(parts[2])
        return None


if __name__ == "__main__":
    server = ThreadingHTTPServer(("", PORT), StudySprintHandler)
    print(f"StudySprint Python server is running at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStudySprint server stopped.")
    finally:
        server.server_close()