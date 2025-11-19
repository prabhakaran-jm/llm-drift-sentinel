terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    # Backend configuration is provided via backend.tfvars
    # Run: terraform init -backend-config=backend.tfvars
    # Or set these via -backend-config flags
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable Vertex AI API
resource "google_project_service" "vertex_ai" {
  project = var.project_id
  service = "aiplatform.googleapis.com"
  
  disable_dependent_services = false
  disable_on_destroy         = false
}

# Enable Pub/Sub API (for Phase 2)
resource "google_project_service" "pubsub" {
  project = var.project_id
  service = "pubsub.googleapis.com"
  
  disable_dependent_services = false
  disable_on_destroy         = false
  
  depends_on = [google_project_service.vertex_ai]
}

# Enable BigQuery API (for Phase 2)
resource "google_project_service" "bigquery" {
  project = var.project_id
  service = "bigquery.googleapis.com"
  
  disable_dependent_services = false
  disable_on_destroy         = false
  
  depends_on = [google_project_service.vertex_ai]
}

# Enable Cloud Run API (for deployment)
resource "google_project_service" "cloud_run" {
  project = var.project_id
  service = "run.googleapis.com"
  
  disable_dependent_services = false
  disable_on_destroy         = false
  
  depends_on = [google_project_service.vertex_ai]
}

# Pub/Sub topic for LLM telemetry (Phase 2)
resource "google_pubsub_topic" "llm_telemetry" {
  name    = "sentinel-llm-telemetry"
  project = var.project_id

  labels = {
    environment = var.environment
    service     = "sentinel"
  }

  depends_on = [google_project_service.pubsub]
}

# Pub/Sub subscription for analyzer (Phase 3)
resource "google_pubsub_subscription" "analyzer_sub" {
  name    = "sentinel-analyzer-sub"
  topic   = google_pubsub_topic.llm_telemetry.name
  project = var.project_id

  ack_deadline_seconds = 60

  message_retention_duration = "604800s" # 7 days

  labels = {
    environment = var.environment
    service     = "sentinel-analyzer"
  }

  depends_on = [google_pubsub_topic.llm_telemetry]
}

# BigQuery dataset for telemetry storage (Phase 2)
resource "google_bigquery_dataset" "telemetry" {
  dataset_id  = "sentinel_telemetry"
  project     = var.project_id
  location    = var.region
  description = "LLM telemetry data for drift and abuse detection"

  labels = {
    environment = var.environment
    service     = "sentinel"
  }

  depends_on = [google_project_service.bigquery]
}

# BigQuery table for telemetry events
resource "google_bigquery_table" "telemetry_events" {
  dataset_id = google_bigquery_dataset.telemetry.dataset_id
  table_id   = "llm_events"
  project    = var.project_id

  description = "LLM request/response telemetry events"

  schema = jsonencode([
    {
      name = "requestId"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "timestamp"
      type = "TIMESTAMP"
      mode = "REQUIRED"
    },
    {
      name = "endpoint"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "method"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "prompt"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "promptLength"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "response"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "responseLength"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "modelName"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "modelVersion"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "tokensIn"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "tokensOut"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "tokensTotal"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "latencyMs"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "status"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "errorMessage"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "environment"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "service"
      type = "STRING"
      mode = "NULLABLE"
    },
  ])

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  labels = {
    environment = var.environment
    service     = "sentinel"
  }

  depends_on = [google_bigquery_dataset.telemetry]
}

