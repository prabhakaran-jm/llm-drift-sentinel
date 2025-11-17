variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "backend_bucket_name" {
  description = "Name of the GCS bucket for Terraform state backend"
  type        = string
  default     = ""
}

variable "backend_prefix" {
  description = "Prefix for Terraform state files in the backend bucket"
  type        = string
  default     = "infra"
}

