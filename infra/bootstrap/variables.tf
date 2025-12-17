variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region"
  type        = string
  default     = "us-east1"
}

variable "backend_bucket_name" {
  description = "Name of the GCS bucket for Terraform state (must be globally unique)"
  type        = string
}

