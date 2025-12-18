# Enable Artifact Registry API
resource "google_project_service" "artifact_registry" {
  project = var.project_id
  service = "artifactregistry.googleapis.com"
  
  disable_dependent_services = false
  disable_on_destroy         = false
  
  depends_on = [google_project_service.cloud_run]
}

# Artifact Registry repository for Docker images
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "llm-sentinel"
  description   = "Docker repository for LLM Sentinel services"
  format        = "DOCKER"

  labels = {
    environment = var.environment
    service     = "sentinel"
  }

  depends_on = [google_project_service.artifact_registry]
}

# Service account for Gateway service
resource "google_service_account" "gateway" {
  account_id   = "sentinel-gateway"
  display_name = "LLM Sentinel Gateway Service Account"
  description  = "Service account for Gateway Cloud Run service"
}

# Service account for Analyzer service
resource "google_service_account" "analyzer" {
  account_id   = "sentinel-analyzer"
  display_name = "LLM Sentinel Analyzer Service Account"
  description  = "Service account for Analyzer Cloud Run service"
}

# IAM roles for Gateway service account
resource "google_project_iam_member" "gateway_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.gateway.email}"
}

resource "google_project_iam_member" "gateway_vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.gateway.email}"
}

# IAM roles for Analyzer service account
resource "google_project_iam_member" "analyzer_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.analyzer.email}"
}

resource "google_project_iam_member" "analyzer_bigquery_user" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.analyzer.email}"
}

resource "google_project_iam_member" "analyzer_bigquery_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.analyzer.email}"
}

resource "google_project_iam_member" "analyzer_vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.analyzer.email}"
}

# Cloud Run service for Gateway
resource "google_cloud_run_service" "gateway" {
  name     = "sentinel-gateway"
  location = var.region
  project  = var.project_id

  template {
    spec {
      service_account_name = google_service_account.gateway.email
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/gateway:latest"
        
        ports {
          container_port = 8080
        }

        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }

        env {
          name  = "GOOGLE_CLOUD_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "GOOGLE_CLOUD_LOCATION"
          value = var.region
        }

        env {
          name  = "VERTEX_LOCATION"
          value = "us-central1"
        }

        env {
          name  = "VERTEX_MODEL"
          value = "gemini-2.0-flash"
        }

        env {
          name  = "PUBSUB_TOPIC_NAME"
          value = google_pubsub_topic.llm_telemetry.name
        }

        env {
          name  = "PUBSUB_ENABLED"
          value = "true"
        }

        env {
          name  = "USE_STUB"
          value = "false"
        }

        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "1"
        "autoscaling.knative.dev/maxScale" = "10"
        "run.googleapis.com/execution-environment" = "gen2"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.cloud_run,
    google_artifact_registry_repository.docker_repo,
    google_service_account.gateway,
  ]
}

# Cloud Run service for Analyzer
resource "google_cloud_run_service" "analyzer" {
  name     = "sentinel-analyzer"
  location = var.region
  project  = var.project_id

  template {
    spec {
      service_account_name = google_service_account.analyzer.email
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/analyzer:latest"
        
        ports {
          container_port = 8080
        }

        startup_probe {
          http_get {
            path = "/health"
            port = 8080
          }
          initial_delay_seconds = 10
          timeout_seconds = 3
          period_seconds = 10
          failure_threshold = 10
        }

        liveness_probe {
          http_get {
            path = "/health"
            port = 8080
          }
          timeout_seconds = 3
          period_seconds = 30
          failure_threshold = 3
        }

        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }

        env {
          name  = "GOOGLE_CLOUD_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "GOOGLE_CLOUD_LOCATION"
          value = var.region
        }

        env {
          name  = "PUBSUB_TOPIC_NAME"
          value = google_pubsub_topic.llm_telemetry.name
        }

        env {
          name  = "PUBSUB_SUBSCRIPTION_NAME"
          value = google_pubsub_subscription.analyzer_sub.name
        }

        env {
          name  = "BIGQUERY_DATASET_ID"
          value = google_bigquery_dataset.telemetry.dataset_id
        }

        env {
          name  = "BIGQUERY_TABLE_ID"
          value = google_bigquery_table.telemetry_events.table_id
        }

        env {
          name  = "BIGQUERY_BASELINE_TABLE_ID"
          value = google_bigquery_table.drift_baselines.table_id
        }

        env {
          name  = "BIGQUERY_ENABLED"
          value = "true"
        }

        env {
          name  = "VERTEX_EMBEDDING_LOCATION"
          value = "us-central1"
        }

        env {
          name  = "VERTEX_EMBEDDING_MODEL"
          value = "text-embedding-004"
        }

        resources {
          limits = {
            cpu    = "2"
            memory = "4Gi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "1"
        "autoscaling.knative.dev/maxScale" = "10"
        "run.googleapis.com/execution-environment" = "gen2"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.cloud_run,
    google_artifact_registry_repository.docker_repo,
    google_service_account.analyzer,
    google_pubsub_subscription.analyzer_sub,
    google_bigquery_table.telemetry_events,
    google_bigquery_table.drift_baselines,
  ]
}

# Cloud Run service for Frontend
resource "google_cloud_run_service" "frontend" {
  name     = "sentinel-frontend"
  location = var.region
  project  = var.project_id

  template {
    spec {
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/frontend:latest"
        
        ports {
          container_port = 8080
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "1"
        "autoscaling.knative.dev/maxScale" = "5"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.cloud_run,
    google_artifact_registry_repository.docker_repo,
    google_cloud_run_service.gateway,
  ]
}

# Allow unauthenticated access to Gateway (for API calls)
resource "google_cloud_run_service_iam_member" "gateway_public" {
  service  = google_cloud_run_service.gateway.name
  location = google_cloud_run_service.gateway.location
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Allow unauthenticated access to Frontend (for web UI)
resource "google_cloud_run_service_iam_member" "frontend_public" {
  service  = google_cloud_run_service.frontend.name
  location = google_cloud_run_service.frontend.location
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}

