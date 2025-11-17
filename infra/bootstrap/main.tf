terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable Cloud Storage API for backend
resource "google_project_service" "storage" {
  project = var.project_id
  service = "storage.googleapis.com"
  
  disable_dependent_services = false
  disable_on_destroy         = false
}

# Create GCS bucket for Terraform state
resource "google_storage_bucket" "terraform_state" {
  name          = var.backend_bucket_name
  project       = var.project_id
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.storage]
}

