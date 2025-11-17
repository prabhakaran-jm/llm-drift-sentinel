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

