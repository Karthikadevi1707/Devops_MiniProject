# StudySprint - College Study Task Tracker

StudySprint is a small full-stack study task tracker. The browser interface is plain HTML, CSS, and JavaScript. The REST API can run with Express or the optional standard-library Python server; both save tasks in the same JSON file, so no database setup is needed.

## Project objective

Help college students organize academic work, set priorities, mark finished tasks, and see what needs attention.

## Problem statement

Students often track assignments, lab records, exams, projects, seminars, and placement preparation in separate notes. StudySprint puts these tasks in one list with a category, priority, and completion status so pending work and urgent tasks are easy to spot.

## Features

- Add and view study tasks.
- Choose an academic category and High, Medium, or Low priority for each task.
- Mark pending tasks complete and delete completed or unwanted tasks.
- See total, completed, pending, and high-priority task counts.
- Filter the list by all, to-do, or completed tasks.
- Start with six sample college tasks on a fresh install.
- Keep tasks in `server/tasks.json` between local server restarts.

## Technologies used

- HTML, CSS, and browser JavaScript for the frontend.
- Node.js and Express.js for the backend and REST API.
- Python 3 standard library as an optional backend alternative.
- A JSON file for simple local data storage.
- Docker and Docker Compose for containers.
- Kubernetes Deployment and NodePort Service for cluster deployment.

## Architecture

```text
Browser (HTML/CSS/JavaScript)
        | HTTP requests to /api/tasks
        v
Node.js + Express server
        | reads and writes
        v
server/tasks.json
```

The Express server also serves the files in `public/`, so the browser UI and API use the same origin.
The optional `app.py` serves those same files and API routes on port 5000.

## Folder structure

```text
StudySprint/
├── app.py
├── server/
│   ├── server.js
│   ├── package.json
│   └── tasks.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── Dockerfile
├── .dockerignore
├── docker-compose.yml
├── README.md
└── k8s/
    ├── deployment.yaml
    └── service.yaml
```

## API endpoints

| Method | URL | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | Return all tasks |
| `POST` | `/api/tasks` | Add a task using `{ "title": "Review biology", "category": "Assignment", "priority": "High" }` |
| `PUT` | `/api/tasks/:id` | Mark the task complete |
| `DELETE` | `/api/tasks/:id` | Delete the task |

Allowed categories are `Assignment`, `Lab Work`, `Project`, `Exam Preparation`, `Seminar`, `Placement`, `Internship`, and `Other`. Allowed priorities are `High`, `Medium`, and `Low`. The server rejects blank or overlong names and invalid category or priority values.

The first-run sample tasks are Complete Data Structures Assignment (High), Prepare C++ Lab Exam (High), Submit Machine Learning Record (Medium), Complete Web Development Project (High), Prepare Seminar Presentation (Medium), and Practice Placement Aptitude (Low). Other task ideas include submitting an internship report, preparing for an internal assessment, completing DBMS lab work or project documentation, attending a project review, preparing viva questions, finishing pending lab records, submitting an assignment before its deadline, and revising for semester exams.

## Run locally

Prerequisite: install Node.js 20 or newer. Open a terminal in the project folder and run:

```powershell
cd server
npm install
npm start
```

Open <http://localhost:3000> in a browser. Keep the terminal running while using the app. New task data is written to `server/tasks.json`.

### Run with Python instead

Install Python 3.9 or newer, then run this command from the project folder:

```powershell
python app.py
```

Open <http://localhost:5000>. This server uses only Python's standard library and writes to the same `server/tasks.json` file as the Express app. Run only one backend at a time to avoid simultaneous writes to that file. Docker and Kubernetes use this Python entry point.

## Docker procedure

Prerequisite: install and start Docker Desktop. From the project folder, build an image:

```powershell
docker build -t studysprint:1.0 .
```

Run the container on host port 5001 and keep its JSON task file connected to the project folder:

```powershell
docker run --name studysprint-app -p 5001:5000 -v "${PWD}/server/tasks.json:/app/server/tasks.json" studysprint:1.0
```

Visit <http://localhost:5001>. Stop the container with `docker stop studysprint-app`; to start it again, use `docker start studysprint-app`; to remove it, use `docker rm -f studysprint-app`.

The Dockerfile uses the Python 3.13 image, copies `app.py` and the frontend, exposes container port 5000, and starts the Python server. The `-p 5001:5000` option maps host port 5001 to the container port. `.dockerignore` prevents local dependencies and Git files from being copied into the image. The volume mount keeps this demo's JSON data on the host. An alternative is `docker compose up --build`; open <http://localhost:5001> and stop it with `docker compose down`.

## Kubernetes procedure

Prerequisites: Docker Desktop with Kubernetes enabled, Kind, Minikube, or another running Kubernetes cluster, plus `kubectl`.

### Use Kind with Docker Desktop

Kind runs a local Kubernetes node as a Docker container. The included `k8s/kind-config.yaml` maps NodePort 30080 to the Windows host. Install Kind, then create the cluster and load the local image:

```powershell
winget install --id Kubernetes.kind --exact
kind create cluster --name studysprint --config k8s/kind-config.yaml
kind load docker-image studysprint:1.0 --name studysprint
```

Apply the app resources and wait for the pod to become ready:

```powershell
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl rollout status deployment/studysprint
kubectl get pods
kubectl get deployments
kubectl get services
```

Open <http://localhost:30080>. The app is served by Python on port 5000 inside each pod; NodePort 30080 is mapped to the host by the Kind configuration.

### Use Docker Desktop Kubernetes

To enable Docker Desktop's own Kubernetes cluster, open Docker Desktop **Settings > Kubernetes**, enable Kubernetes, and apply/restart. Wait for the cluster to finish starting, then verify it:

```powershell
docker desktop kubernetes status
kubectl config current-context
```

The Docker Desktop context should be selected before deployment. The cluster on this machine was disabled when this guide was prepared. Once the context is ready, build the image:

```powershell
docker build -t studysprint:1.0 .
```

For Docker Desktop Kubernetes, the cluster can use the image built locally. Minikube users should load it with `minikube image load studysprint:1.0` before applying the manifests.

Apply the Deployment and Service, then inspect them:

```powershell
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl get pods
kubectl get deployments
kubectl get services
```

Wait until the pod shows `Running` and `READY 1/1`. `kubectl get deployments` shows the desired and ready replica counts. To inspect details, use `kubectl describe deployment studysprint` or `kubectl describe service studysprint-service`. On Docker Desktop, open <http://localhost:30080>. With Minikube, run `minikube service studysprint-service --url` and open the URL printed by that command.

To remove the resources:

```powershell
kubectl delete -f k8s/service.yaml
kubectl delete -f k8s/deployment.yaml
```

### Kubernetes YAML explained

`deployment.yaml`:

- `apiVersion: apps/v1` selects the Kubernetes API version for Deployments; `kind: Deployment` asks Kubernetes to keep the app running.
- `metadata.name` names the Deployment. Labels are tags used to identify the app.
- `spec.replicas: 1` keeps the file-backed task data consistent; multiple replicas need shared storage or a database.
- `selector.matchLabels` tells the Deployment which pods it manages. The pod template has the matching `app: studysprint` label.
- `template.spec.containers` describes the container. `image` is the Docker image name; `imagePullPolicy: IfNotPresent` allows a locally built image to be used when available.
- `containerPort: 5000` documents the port the Python process listens on inside the pod.

`service.yaml`:

- `apiVersion: v1` and `kind: Service` define a stable network address for the pod.
- `metadata.name` gives the Service its name.
- `spec.type: NodePort` makes it reachable through a port on the cluster node.
- `selector` sends traffic to pods labelled `app: studysprint`.
- `port` and `targetPort` are the Python app port 5000; `nodePort: 30080` is the browser-facing cluster port.

**Important JSON storage limitation:** task changes are stored in the pod's local `tasks.json` and can be lost when the pod is replaced. One replica keeps requests consistent during normal operation, but it does not provide durable storage. Use a database or persistent volume for reliable production data or multiple replicas.

## Step-by-step development procedure

1. Create `server/` and `public/` to keep backend and browser files separate.
2. Add Express and define the four REST routes in `server/server.js`.
3. Read and write the task array in `server/tasks.json`.
4. Build the task form, category and priority controls, task list, filters, and summary counts in `public/`.
5. Use `fetch()` in `public/script.js` to call the API and refresh the page state.
6. Run locally and check adding, completing, filtering, deleting, and refreshing tasks.
7. Add the Docker image definition and compose file, then build and run the container.
8. Apply the Kubernetes Deployment and NodePort Service to a running cluster.

## Expected output

The browser shows six college study tasks with their categories, priority labels, and pending status. The dashboard displays Total Tasks, Completed Tasks, Pending Tasks, and High Priority Tasks. Adding a task puts it at the top; completing it changes its status and completed styling; deleting it removes it from the list. Filters switch between all, pending, and completed tasks.

## Common errors and solutions

| Error | Solution |
| --- | --- |
| `npm` or `node` is not recognized | Install Node.js 20+ and reopen the terminal so PATH updates. |
| `EADDRINUSE` on port 3000 | Stop the other app using port 3000, or run PowerShell with `$env:PORT=3001; npm start` and visit port 3001. |
| API responds with a validation error | Choose one of the listed categories and priorities and enter a task name of 1 to 160 characters. |
| Browser says it cannot reach the app | Start the server with `npm start` and use `http://localhost:3000`, not a file URL. |
| Docker daemon is unavailable | Start Docker Desktop and wait for its engine to finish starting. |
| Docker says host port 5001 is already allocated | Stop the process/container using that port, or map another host port, such as `-p 5002:5000`. |
| Kubernetes pod is `ImagePullBackOff` | Build `studysprint:1.0` locally; for Minikube, also run `minikube image load studysprint:1.0`. Check `kubectl describe pod` for details. |
| NodePort URL does not load | Confirm the pod is Ready with `kubectl get pods`; check `kubectl get services`; for Minikube use `minikube service studysprint-service --url`. |
| Tasks differ between Kubernetes pods | This is expected with two replicas and separate JSON files. Use one replica for the demo or shared storage/a database for consistent multi-pod data. |

## Simple viva questions and answers

1. **What is StudySprint?** A web app that lets college students categorize, prioritize, and track academic tasks.
2. **What does the frontend do?** It displays the task form, list, filters, and counts, and sends requests to the API.
3. **What does Express do?** It serves the web files and handles the task API routes.
4. **What is a REST API?** A way for the browser and server to exchange resources using HTTP methods such as GET, POST, PUT, and DELETE.
5. **Why use JSON here?** It is a readable, simple file format that avoids database setup for a small learning project.
6. **What does `GET /api/tasks` do?** It returns the saved task list as JSON.
7. **What does task priority represent?** How urgently a student wants to work on a task: High, Medium, or Low.
8. **What does Docker do?** It packages the app and its runtime into an image that can run in a container.
9. **What is the purpose of a Kubernetes Deployment?** It creates and maintains the requested number of app pods, here two.
10. **What does a NodePort Service do?** It exposes the app through a port on the Kubernetes node.
11. **Why can two replicas show different tasks?** Each pod writes to its own local JSON file; shared storage or a database is needed to synchronize them.

## Conclusion

StudySprint demonstrates a complete beginner-friendly web project: a browser UI, an Express REST API, categorized and prioritized tasks, simple JSON persistence, a Docker image, and a two-replica Kubernetes deployment. It is suitable for a college mini project; reliable multi-replica use requires shared persistent storage or a database.