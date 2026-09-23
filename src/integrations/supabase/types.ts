export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  glue: {
    Tables: {
      ai_decision_trace: {
        Row: {
          confidence: number | null
          decision: string | null
          escalated: boolean
          id: string
          model: string | null
          prompt: string | null
          reasoning: string | null
          risk: string | null
          run_id: string | null
          tenant_id: string | null
          ts: string
        }
        Insert: {
          confidence?: number | null
          decision?: string | null
          escalated?: boolean
          id?: string
          model?: string | null
          prompt?: string | null
          reasoning?: string | null
          risk?: string | null
          run_id?: string | null
          tenant_id?: string | null
          ts?: string
        }
        Update: {
          confidence?: number | null
          decision?: string | null
          escalated?: boolean
          id?: string
          model?: string | null
          prompt?: string | null
          reasoning?: string | null
          risk?: string | null
          run_id?: string | null
          tenant_id?: string | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_decision_trace_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      api_requests: {
        Row: {
          action: string
          created_at: string
          duration_ms: number | null
          id: string
          mock: boolean
          request_data: Json | null
          response_data: Json | null
          service: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          mock?: boolean
          request_data?: Json | null
          response_data?: Json | null
          service: string
          success?: boolean
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          mock?: boolean
          request_data?: Json | null
          response_data?: Json | null
          service?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      circuit_breaker_events: {
        Row: {
          connector: string
          detail: Json
          from_state: string | null
          id: string
          reason: string | null
          to_state: string
          ts: string
        }
        Insert: {
          connector: string
          detail?: Json
          from_state?: string | null
          id?: string
          reason?: string | null
          to_state: string
          ts?: string
        }
        Update: {
          connector?: string
          detail?: Json
          from_state?: string | null
          id?: string
          reason?: string | null
          to_state?: string
          ts?: string
        }
        Relationships: []
      }
      connector_capabilities: {
        Row: {
          connector_id: string
          description: string | null
          id: string
          input_schema: Json
          kind: string
          name: string
          output_schema: Json
          rate_limit_per_min: number | null
          retryable: boolean
        }
        Insert: {
          connector_id: string
          description?: string | null
          id?: string
          input_schema?: Json
          kind: string
          name: string
          output_schema?: Json
          rate_limit_per_min?: number | null
          retryable?: boolean
        }
        Update: {
          connector_id?: string
          description?: string | null
          id?: string
          input_schema?: Json
          kind?: string
          name?: string
          output_schema?: Json
          rate_limit_per_min?: number | null
          retryable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "connector_capabilities_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_catalog: {
        Row: {
          auth_model: string
          category: string | null
          created_at: string
          description: string | null
          featured: boolean
          homepage: string | null
          icon: string | null
          id: string
          key: string
          name: string
          publisher: string
          state: string
        }
        Insert: {
          auth_model?: string
          category?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          homepage?: string | null
          icon?: string | null
          id?: string
          key: string
          name: string
          publisher?: string
          state?: string
        }
        Update: {
          auth_model?: string
          category?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          homepage?: string | null
          icon?: string | null
          id?: string
          key?: string
          name?: string
          publisher?: string
          state?: string
        }
        Relationships: []
      }
      connector_circuit_breakers: {
        Row: {
          connector: string
          failure_count: number
          failure_threshold: number
          half_open_probes: number
          last_failure_at: string | null
          last_transition_at: string
          next_attempt_at: string | null
          opened_at: string | null
          recovery_window_seconds: number
          state: string
          success_count: number
          updated_at: string
        }
        Insert: {
          connector: string
          failure_count?: number
          failure_threshold?: number
          half_open_probes?: number
          last_failure_at?: string | null
          last_transition_at?: string
          next_attempt_at?: string | null
          opened_at?: string | null
          recovery_window_seconds?: number
          state?: string
          success_count?: number
          updated_at?: string
        }
        Update: {
          connector?: string
          failure_count?: number
          failure_threshold?: number
          half_open_probes?: number
          last_failure_at?: string | null
          last_transition_at?: string
          next_attempt_at?: string | null
          opened_at?: string | null
          recovery_window_seconds?: number
          state?: string
          success_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      connector_installations: {
        Row: {
          config: Json
          connector_id: string
          connector_version_id: string | null
          enabled: boolean
          id: string
          installed_at: string
          installed_by: string | null
          tenant_id: string
        }
        Insert: {
          config?: Json
          connector_id: string
          connector_version_id?: string | null
          enabled?: boolean
          id?: string
          installed_at?: string
          installed_by?: string | null
          tenant_id: string
        }
        Update: {
          config?: Json
          connector_id?: string
          connector_version_id?: string | null
          enabled?: boolean
          id?: string
          installed_at?: string
          installed_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_installations_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_installations_connector_version_id_fkey"
            columns: ["connector_version_id"]
            isOneToOne: false
            referencedRelation: "connector_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_schemas: {
        Row: {
          capabilities: Json
          connector: string
          created_at: string
          description: string | null
          id: string
          input_schema: Json
          output_schema: Json
          version: number
        }
        Insert: {
          capabilities?: Json
          connector: string
          created_at?: string
          description?: string | null
          id?: string
          input_schema?: Json
          output_schema?: Json
          version?: number
        }
        Update: {
          capabilities?: Json
          connector?: string
          created_at?: string
          description?: string | null
          id?: string
          input_schema?: Json
          output_schema?: Json
          version?: number
        }
        Relationships: []
      }
      connector_state: {
        Row: {
          backoff_until: string | null
          connector: string
          failure_rate: number
          id: string
          last_error: string | null
          last_success_at: string | null
          latency_ms: number | null
          quota_limit: number
          quota_used: number
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          backoff_until?: string | null
          connector: string
          failure_rate?: number
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          quota_limit?: number
          quota_used?: number
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          backoff_until?: string | null
          connector?: string
          failure_rate?: number
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          quota_limit?: number
          quota_used?: number
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      connector_versions: {
        Row: {
          connector_id: string
          id: string
          release_notes: string | null
          released_at: string
          state: string
          version: string
        }
        Insert: {
          connector_id: string
          id?: string
          release_notes?: string | null
          released_at?: string
          state?: string
          version: string
        }
        Update: {
          connector_id?: string
          id?: string
          release_notes?: string | null
          released_at?: string
          state?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_versions_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_letter_recovery: {
        Row: {
          attempts: number
          id: string
          job_id: string | null
          last_error: string | null
          requested_at: string
          requested_by: string | null
          resolved_at: string | null
          run_id: string | null
          state: string
          tenant_id: string | null
        }
        Insert: {
          attempts?: number
          id?: string
          job_id?: string | null
          last_error?: string | null
          requested_at?: string
          requested_by?: string | null
          resolved_at?: string | null
          run_id?: string | null
          state?: string
          tenant_id?: string | null
        }
        Update: {
          attempts?: number
          id?: string
          job_id?: string | null
          last_error?: string | null
          requested_at?: string
          requested_by?: string | null
          resolved_at?: string | null
          run_id?: string | null
          state?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      deployment_profiles: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          environment: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          environment: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          environment?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      deployment_validations: {
        Row: {
          checks: Json
          failed: number
          id: string
          passed: number
          profile_id: string | null
          ran_at: string
          ran_by: string | null
          state: string
          tenant_id: string
          warnings: number
        }
        Insert: {
          checks?: Json
          failed?: number
          id?: string
          passed?: number
          profile_id?: string | null
          ran_at?: string
          ran_by?: string | null
          state?: string
          tenant_id: string
          warnings?: number
        }
        Update: {
          checks?: Json
          failed?: number
          id?: string
          passed?: number
          profile_id?: string | null
          ran_at?: string
          ran_by?: string | null
          state?: string
          tenant_id?: string
          warnings?: number
        }
        Relationships: [
          {
            foreignKeyName: "deployment_validations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "deployment_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      environment_configs: {
        Row: {
          id: string
          key: string
          profile_id: string
          secret_ref: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          profile_id: string
          secret_ref?: string | null
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          profile_id?: string
          secret_ref?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "environment_configs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "deployment_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_policies: {
        Row: {
          auto_reject_below: number | null
          created_at: string
          enabled: boolean
          escalation_role: string
          id: string
          min_confidence: number
          name: string
          tenant_id: string | null
        }
        Insert: {
          auto_reject_below?: number | null
          created_at?: string
          enabled?: boolean
          escalation_role?: string
          id?: string
          min_confidence?: number
          name: string
          tenant_id?: string | null
        }
        Update: {
          auto_reject_below?: number | null
          created_at?: string
          enabled?: boolean
          escalation_role?: string
          id?: string
          min_confidence?: number
          name?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      load_benchmarks: {
        Row: {
          completed_runs: number
          config: Json
          created_by: string | null
          duration_ms: number | null
          ended_at: string | null
          failed_runs: number
          id: string
          name: string
          p50_latency_ms: number | null
          p95_latency_ms: number | null
          p99_latency_ms: number | null
          report: Json
          scenario: string
          started_at: string
          state: string
          tenant_id: string | null
          throughput_per_sec: number | null
          total_runs: number
        }
        Insert: {
          completed_runs?: number
          config?: Json
          created_by?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          failed_runs?: number
          id?: string
          name: string
          p50_latency_ms?: number | null
          p95_latency_ms?: number | null
          p99_latency_ms?: number | null
          report?: Json
          scenario: string
          started_at?: string
          state?: string
          tenant_id?: string | null
          throughput_per_sec?: number | null
          total_runs?: number
        }
        Update: {
          completed_runs?: number
          config?: Json
          created_by?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          failed_runs?: number
          id?: string
          name?: string
          p50_latency_ms?: number | null
          p95_latency_ms?: number | null
          p99_latency_ms?: number | null
          report?: Json
          scenario?: string
          started_at?: string
          state?: string
          tenant_id?: string | null
          throughput_per_sec?: number | null
          total_runs?: number
        }
        Relationships: []
      }
      manual_launches: {
        Row: {
          created_at: string
          dag_id: string
          id: string
          operator_user_id: string
          parameters: Json
          reason: string | null
          run_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          dag_id: string
          id?: string
          operator_user_id: string
          parameters?: Json
          reason?: string | null
          run_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          dag_id?: string
          id?: string
          operator_user_id?: string
          parameters?: Json
          reason?: string | null
          run_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          detail: Json
          id: string
          state: string
          step_key: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          detail?: Json
          id?: string
          state?: string
          step_key: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          detail?: Json
          id?: string
          state?: string
          step_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_step_key_fkey"
            columns: ["step_key"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["key"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          required: boolean
          sort_order: number
          title: string
        }
        Insert: {
          category?: string
          description?: string | null
          id?: string
          key: string
          required?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          required?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      operator_bookmarks: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          note: string | null
          ref_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          note?: string | null
          ref_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          note?: string | null
          ref_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      pack_imports: {
        Row: {
          created_at: string
          id: string
          imported_at: string | null
          imported_by: string | null
          manifest: Json
          pack_id: string | null
          source: string
          state: string
          tenant_id: string
          validation_report: Json
        }
        Insert: {
          created_at?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          manifest?: Json
          pack_id?: string | null
          source?: string
          state?: string
          tenant_id: string
          validation_report?: Json
        }
        Update: {
          created_at?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          manifest?: Json
          pack_id?: string | null
          source?: string
          state?: string
          tenant_id?: string
          validation_report?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pack_imports_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "workflow_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      queue_backpressure: {
        Row: {
          detail: Json
          id: string
          level: string
          partition_key: string | null
          signal: string
          tenant_id: string | null
          throttle_ms: number
          ts: string
        }
        Insert: {
          detail?: Json
          id?: string
          level?: string
          partition_key?: string | null
          signal: string
          tenant_id?: string | null
          throttle_ms?: number
          ts?: string
        }
        Update: {
          detail?: Json
          id?: string
          level?: string
          partition_key?: string | null
          signal?: string
          tenant_id?: string | null
          throttle_ms?: number
          ts?: string
        }
        Relationships: []
      }
      queue_partitions: {
        Row: {
          description: string | null
          max_concurrency: number
          partition_key: string
          paused: boolean
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          description?: string | null
          max_concurrency?: number
          partition_key: string
          paused?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          description?: string | null
          max_concurrency?: number
          partition_key?: string
          paused?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      queue_pressure_signals: {
        Row: {
          captured_at: string
          dead_letter: number
          delayed: number
          id: string
          in_flight: number
          partition_key: string | null
          pressure_score: number
          queued: number
          recommendation: string | null
          retrying: number
          tenant_id: string | null
        }
        Insert: {
          captured_at?: string
          dead_letter?: number
          delayed?: number
          id?: string
          in_flight?: number
          partition_key?: string | null
          pressure_score?: number
          queued?: number
          recommendation?: string | null
          retrying?: number
          tenant_id?: string | null
        }
        Update: {
          captured_at?: string
          dead_letter?: number
          delayed?: number
          id?: string
          in_flight?: number
          partition_key?: string | null
          pressure_score?: number
          queued?: number
          recommendation?: string | null
          retrying?: number
          tenant_id?: string | null
        }
        Relationships: []
      }
      runtime_anomalies: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          baseline_value: number | null
          detected_at: string
          evidence: Json
          explanation: string
          id: string
          kind: string
          metric_value: number | null
          scope: string
          severity: string
          subject: string | null
          tenant_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          baseline_value?: number | null
          detected_at?: string
          evidence?: Json
          explanation: string
          id?: string
          kind: string
          metric_value?: number | null
          scope: string
          severity?: string
          subject?: string | null
          tenant_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          baseline_value?: number | null
          detected_at?: string
          evidence?: Json
          explanation?: string
          id?: string
          kind?: string
          metric_value?: number | null
          scope?: string
          severity?: string
          subject?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      runtime_audit_log: {
        Row: {
          action: string
          actor: string
          details: Json
          id: string
          subject_id: string | null
          subject_type: string | null
          tenant_id: string | null
          ts: string
        }
        Insert: {
          action: string
          actor: string
          details?: Json
          id?: string
          subject_id?: string | null
          subject_type?: string | null
          tenant_id?: string | null
          ts?: string
        }
        Update: {
          action?: string
          actor?: string
          details?: Json
          id?: string
          subject_id?: string | null
          subject_type?: string | null
          tenant_id?: string | null
          ts?: string
        }
        Relationships: []
      }
      runtime_triggers: {
        Row: {
          condition: Json
          cooldown_seconds: number
          created_at: string
          created_by: string | null
          dag_id: string
          enabled: boolean
          id: string
          last_fired_at: string | null
          max_depth: number
          name: string
          source_event_type: string
          tenant_id: string
        }
        Insert: {
          condition?: Json
          cooldown_seconds?: number
          created_at?: string
          created_by?: string | null
          dag_id: string
          enabled?: boolean
          id?: string
          last_fired_at?: string | null
          max_depth?: number
          name: string
          source_event_type: string
          tenant_id: string
        }
        Update: {
          condition?: Json
          cooldown_seconds?: number
          created_at?: string
          created_by?: string | null
          dag_id?: string
          enabled?: boolean
          id?: string
          last_fired_at?: string | null
          max_depth?: number
          name?: string
          source_event_type?: string
          tenant_id?: string
        }
        Relationships: []
      }
      saved_dashboards: {
        Row: {
          created_at: string
          id: string
          layout: Json
          name: string
          owner_user_id: string
          shared: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json
          name: string
          owner_user_id: string
          shared?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          name?: string
          owner_user_id?: string
          shared?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_workflows: {
        Row: {
          created_at: string
          edges: Json | null
          id: string
          name: string
          nodes: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          edges?: Json | null
          id?: string
          name: string
          nodes?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          edges?: Json | null
          id?: string
          name?: string
          nodes?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scaling_metrics: {
        Row: {
          captured_at: string
          id: string
          meta: Json
          metric: string
          scope: string
          tenant_id: string | null
          value: number
        }
        Insert: {
          captured_at?: string
          id?: string
          meta?: Json
          metric: string
          scope: string
          tenant_id?: string | null
          value: number
        }
        Update: {
          captured_at?: string
          id?: string
          meta?: Json
          metric?: string
          scope?: string
          tenant_id?: string | null
          value?: number
        }
        Relationships: []
      }
      scheduler_leases: {
        Row: {
          acquired_at: string
          expires_at: string
          holder: string
          id: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          holder: string
          id: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          holder?: string
          id?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          actor_user_id: string | null
          category: string
          details: Json
          id: string
          message: string | null
          severity: string
          subject_id: string | null
          subject_type: string | null
          tenant_id: string | null
          ts: string
        }
        Insert: {
          actor_user_id?: string | null
          category: string
          details?: Json
          id?: string
          message?: string | null
          severity?: string
          subject_id?: string | null
          subject_type?: string | null
          tenant_id?: string | null
          ts?: string
        }
        Update: {
          actor_user_id?: string | null
          category?: string
          details?: Json
          id?: string
          message?: string | null
          severity?: string
          subject_id?: string | null
          subject_type?: string | null
          tenant_id?: string | null
          ts?: string
        }
        Relationships: []
      }
      sla_breaches: {
        Row: {
          budget_ms: number
          detected_at: string
          escalated: boolean
          id: string
          observed_ms: number
          policy_id: string | null
          resolved_at: string | null
          run_id: string | null
          scope: string
          severity: string
          step_id: string | null
          target: string
          tenant_id: string | null
        }
        Insert: {
          budget_ms: number
          detected_at?: string
          escalated?: boolean
          id?: string
          observed_ms: number
          policy_id?: string | null
          resolved_at?: string | null
          run_id?: string | null
          scope: string
          severity: string
          step_id?: string | null
          target: string
          tenant_id?: string | null
        }
        Update: {
          budget_ms?: number
          detected_at?: string
          escalated?: boolean
          id?: string
          observed_ms?: number
          policy_id?: string | null
          resolved_at?: string | null
          run_id?: string | null
          scope?: string
          severity?: string
          step_id?: string | null
          target?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_breaches_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          created_at: string
          enabled: boolean
          escalate_after_ms: number | null
          id: string
          max_duration_ms: number
          scope: string
          severity: string
          target: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          escalate_after_ms?: number | null
          id?: string
          max_duration_ms: number
          scope: string
          severity?: string
          target: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          escalate_after_ms?: number | null
          id?: string
          max_duration_ms?: number
          scope?: string
          severity?: string
          target?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      telemetry_aggregates: {
        Row: {
          created_at: string
          id: string
          metric: string
          sample_count: number
          scope: string
          tenant_id: string | null
          value: number
          window_seconds: number
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          sample_count?: number
          scope: string
          tenant_id?: string | null
          value: number
          window_seconds?: number
          window_start: string
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          sample_count?: number
          scope?: string
          tenant_id?: string | null
          value?: number
          window_seconds?: number
          window_start?: string
        }
        Relationships: []
      }
      template_categories: {
        Row: {
          description: string | null
          icon: string | null
          id: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          icon?: string | null
          id?: string
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          icon?: string | null
          id?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      template_installs: {
        Row: {
          id: string
          installed_at: string
          installed_by: string | null
          state: string
          template_id: string
          template_version_id: string
          tenant_id: string
          workflow_definition_id: string | null
        }
        Insert: {
          id?: string
          installed_at?: string
          installed_by?: string | null
          state?: string
          template_id: string
          template_version_id: string
          tenant_id: string
          workflow_definition_id?: string | null
        }
        Update: {
          id?: string
          installed_at?: string
          installed_by?: string | null
          state?: string
          template_id?: string
          template_version_id?: string
          tenant_id?: string
          workflow_definition_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_installs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_installs_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          changelog: string | null
          created_at: string
          governance_policies: Json
          graph: Json
          id: string
          published_at: string | null
          required_connectors: string[]
          state: string
          template_id: string
          version: number
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          governance_policies?: Json
          graph?: Json
          id?: string
          published_at?: string | null
          required_connectors?: string[]
          state?: string
          template_id: string
          version: number
        }
        Update: {
          changelog?: string | null
          created_at?: string
          governance_policies?: Json
          graph?: Json
          id?: string
          published_at?: string | null
          required_connectors?: string[]
          state?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          role: Database["glue"]["Enums"]["operator_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["glue"]["Enums"]["operator_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["glue"]["Enums"]["operator_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
        }
        Relationships: []
      }
      trace_spans: {
        Row: {
          attributes: Json
          correlation_id: string | null
          duration_ms: number | null
          ended_at: string | null
          events: Json
          id: string
          kind: string
          name: string
          parent_span_id: string | null
          run_id: string | null
          service: string
          span_id: string
          started_at: string
          status: string
          step_id: string | null
          tenant_id: string | null
          trace_id: string
        }
        Insert: {
          attributes?: Json
          correlation_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          events?: Json
          id?: string
          kind?: string
          name: string
          parent_span_id?: string | null
          run_id?: string | null
          service?: string
          span_id: string
          started_at?: string
          status?: string
          step_id?: string | null
          tenant_id?: string | null
          trace_id: string
        }
        Update: {
          attributes?: Json
          correlation_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          events?: Json
          id?: string
          kind?: string
          name?: string
          parent_span_id?: string | null
          run_id?: string | null
          service?: string
          span_id?: string
          started_at?: string
          status?: string
          step_id?: string | null
          tenant_id?: string | null
          trace_id?: string
        }
        Relationships: []
      }
      trigger_activations: {
        Row: {
          depth: number
          fired_at: string
          id: string
          payload: Json
          run_id: string | null
          source_label: string | null
          suppressed: boolean
          suppressed_reason: string | null
          tenant_id: string
          trigger_id: string | null
          trigger_kind: string
        }
        Insert: {
          depth?: number
          fired_at?: string
          id?: string
          payload?: Json
          run_id?: string | null
          source_label?: string | null
          suppressed?: boolean
          suppressed_reason?: string | null
          tenant_id: string
          trigger_id?: string | null
          trigger_kind: string
        }
        Update: {
          depth?: number
          fired_at?: string
          id?: string
          payload?: Json
          run_id?: string | null
          source_label?: string | null
          suppressed?: boolean
          suppressed_reason?: string | null
          tenant_id?: string
          trigger_id?: string | null
          trigger_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "trigger_activations_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "runtime_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          body: Json
          correlation_id: string | null
          endpoint_id: string
          error: string | null
          headers: Json
          id: string
          idempotency_key: string | null
          raw_body: string | null
          received_at: string
          run_id: string | null
          signature_error: string | null
          signature_valid: boolean | null
          source_ip: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          body?: Json
          correlation_id?: string | null
          endpoint_id: string
          error?: string | null
          headers?: Json
          id?: string
          idempotency_key?: string | null
          raw_body?: string | null
          received_at?: string
          run_id?: string | null
          signature_error?: string | null
          signature_valid?: boolean | null
          source_ip?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          body?: Json
          correlation_id?: string | null
          endpoint_id?: string
          error?: string | null
          headers?: Json
          id?: string
          idempotency_key?: string | null
          raw_body?: string | null
          received_at?: string
          run_id?: string | null
          signature_error?: string | null
          signature_valid?: boolean | null
          source_ip?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          dag_id: string
          description: string | null
          endpoint_key: string
          id: string
          paused: boolean
          rate_limit_per_min: number
          signature_header: string | null
          signature_scheme: string | null
          signing_secret: string | null
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          dag_id: string
          description?: string | null
          endpoint_key: string
          id?: string
          paused?: boolean
          rate_limit_per_min?: number
          signature_header?: string | null
          signature_scheme?: string | null
          signing_secret?: string | null
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          dag_id?: string
          description?: string | null
          endpoint_key?: string
          id?: string
          paused?: boolean
          rate_limit_per_min?: number
          signature_header?: string | null
          signature_scheme?: string | null
          signing_secret?: string | null
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      worker_capacity_snapshots: {
        Row: {
          active_jobs: number
          captured_at: string
          health_state: string
          id: string
          max_concurrency: number
          region: string | null
          saturation: number
          worker_id: string
        }
        Insert: {
          active_jobs?: number
          captured_at?: string
          health_state?: string
          id?: string
          max_concurrency?: number
          region?: string | null
          saturation?: number
          worker_id: string
        }
        Update: {
          active_jobs?: number
          captured_at?: string
          health_state?: string
          id?: string
          max_concurrency?: number
          region?: string | null
          saturation?: number
          worker_id?: string
        }
        Relationships: []
      }
      worker_heartbeats: {
        Row: {
          jobs_processed: number
          last_seen_at: string
          metadata: Json
          status: string
          worker_id: string
        }
        Insert: {
          jobs_processed?: number
          last_seen_at?: string
          metadata?: Json
          status?: string
          worker_id: string
        }
        Update: {
          jobs_processed?: number
          last_seen_at?: string
          metadata?: Json
          status?: string
          worker_id?: string
        }
        Relationships: []
      }
      worker_registry: {
        Row: {
          active_jobs: number
          capabilities: string[]
          drained_at: string | null
          health_state: string
          last_heartbeat: string
          max_concurrency: number
          metadata: Json
          pid: string | null
          process_kind: string | null
          region: string
          shutdown_requested_at: string | null
          started_at: string
          total_failed: number
          total_processed: number
          worker_id: string
        }
        Insert: {
          active_jobs?: number
          capabilities?: string[]
          drained_at?: string | null
          health_state?: string
          last_heartbeat?: string
          max_concurrency?: number
          metadata?: Json
          pid?: string | null
          process_kind?: string | null
          region?: string
          shutdown_requested_at?: string | null
          started_at?: string
          total_failed?: number
          total_processed?: number
          worker_id: string
        }
        Update: {
          active_jobs?: number
          capabilities?: string[]
          drained_at?: string | null
          health_state?: string
          last_heartbeat?: string
          max_concurrency?: number
          metadata?: Json
          pid?: string | null
          process_kind?: string | null
          region?: string
          shutdown_requested_at?: string | null
          started_at?: string
          total_failed?: number
          total_processed?: number
          worker_id?: string
        }
        Relationships: []
      }
      workflow_approvals: {
        Row: {
          dag_node_id: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          escalated_to: string | null
          expires_at: string | null
          id: string
          job_id: string | null
          reason: string | null
          requested_at: string
          run_id: string
          state: string
          step_id: string | null
          tenant_id: string | null
        }
        Insert: {
          dag_node_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          escalated_to?: string | null
          expires_at?: string | null
          id?: string
          job_id?: string | null
          reason?: string | null
          requested_at?: string
          run_id: string
          state?: string
          step_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          dag_node_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          escalated_to?: string | null
          expires_at?: string | null
          id?: string
          job_id?: string | null
          reason?: string | null
          requested_at?: string
          run_id?: string
          state?: string
          step_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_approvals_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_step_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_checkpoints: {
        Row: {
          id: string
          run_id: string
          snapshot: Json
          step_index: number
          tenant_id: string | null
          ts: string
          workflow_version_id: string | null
        }
        Insert: {
          id?: string
          run_id: string
          snapshot?: Json
          step_index: number
          tenant_id?: string | null
          ts?: string
          workflow_version_id?: string | null
        }
        Update: {
          id?: string
          run_id?: string
          snapshot?: Json
          step_index?: number
          tenant_id?: string | null
          ts?: string
          workflow_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_checkpoints_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_dags: {
        Row: {
          created_at: string
          graph: Json
          id: string
          name: string
          tenant_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          graph?: Json
          id: string
          name: string
          tenant_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          graph?: Json
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      workflow_dead_letter: {
        Row: {
          attempts: number
          dag_node_id: string
          id: string
          job_id: string
          last_error: string | null
          moved_at: string
          payload: Json
          run_id: string
          tenant_id: string | null
        }
        Insert: {
          attempts: number
          dag_node_id: string
          id?: string
          job_id: string
          last_error?: string | null
          moved_at?: string
          payload?: Json
          run_id: string
          tenant_id?: string | null
        }
        Update: {
          attempts?: number
          dag_node_id?: string
          id?: string
          job_id?: string
          last_error?: string | null
          moved_at?: string
          payload?: Json
          run_id?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      workflow_definitions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          latest_version: number
          name: string
          owner_user_id: string | null
          state: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          latest_version?: number
          name: string
          owner_user_id?: string | null
          state?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          latest_version?: number
          name?: string
          owner_user_id?: string | null
          state?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_events: {
        Row: {
          archived_at: string | null
          data: Json
          id: string
          message: string | null
          partition_key: string
          run_id: string | null
          severity: string
          source: string | null
          step_id: string | null
          tenant_id: string | null
          ts: string
          type: string
        }
        Insert: {
          archived_at?: string | null
          data?: Json
          id?: string
          message?: string | null
          partition_key?: string
          run_id?: string | null
          severity?: string
          source?: string | null
          step_id?: string | null
          tenant_id?: string | null
          ts?: string
          type: string
        }
        Update: {
          archived_at?: string | null
          data?: Json
          id?: string
          message?: string | null
          partition_key?: string
          run_id?: string | null
          severity?: string
          source?: string | null
          step_id?: string | null
          tenant_id?: string | null
          ts?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_step_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_incidents: {
        Row: {
          acknowledged_by: string | null
          category: string | null
          closed_at: string | null
          connector: string | null
          id: string
          opened_at: string
          recovery_state: string
          resolved_at: string | null
          run_id: string | null
          severity: string
          summary: string
          tenant_id: string | null
        }
        Insert: {
          acknowledged_by?: string | null
          category?: string | null
          closed_at?: string | null
          connector?: string | null
          id?: string
          opened_at?: string
          recovery_state?: string
          resolved_at?: string | null
          run_id?: string | null
          severity?: string
          summary: string
          tenant_id?: string | null
        }
        Update: {
          acknowledged_by?: string | null
          category?: string | null
          closed_at?: string | null
          connector?: string | null
          id?: string
          opened_at?: string
          recovery_state?: string
          resolved_at?: string | null
          run_id?: string | null
          severity?: string
          summary?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_incidents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_jobs: {
        Row: {
          backoff_until: string | null
          completed_at: string | null
          created_at: string
          dag_node_id: string
          error: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          max_retries: number
          partition_key: string
          payload: Json
          priority: number
          priority_class: string
          region: string
          retry_attempt: number
          run_id: string
          scheduled_at: string
          shard_id: number
          started_at: string | null
          state: string
          step_id: string | null
          tenant_id: string | null
          updated_at: string
          worker_id: string | null
          workflow_version_id: string | null
        }
        Insert: {
          backoff_until?: string | null
          completed_at?: string | null
          created_at?: string
          dag_node_id: string
          error?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key: string
          lease_expires_at?: string | null
          max_retries?: number
          partition_key?: string
          payload?: Json
          priority?: number
          priority_class?: string
          region?: string
          retry_attempt?: number
          run_id: string
          scheduled_at?: string
          shard_id?: number
          started_at?: string | null
          state?: string
          step_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          worker_id?: string | null
          workflow_version_id?: string | null
        }
        Update: {
          backoff_until?: string | null
          completed_at?: string | null
          created_at?: string
          dag_node_id?: string
          error?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string
          lease_expires_at?: string | null
          max_retries?: number
          partition_key?: string
          payload?: Json
          priority?: number
          priority_class?: string
          region?: string
          retry_attempt?: number
          run_id?: string
          scheduled_at?: string
          shard_id?: number
          started_at?: string | null
          state?: string
          step_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          worker_id?: string | null
          workflow_version_id?: string | null
        }
        Relationships: []
      }
      workflow_knowledge: {
        Row: {
          business_outcome: string | null
          created_at: string
          definition_id: string
          id: string
          known_risks: string | null
          operational_notes: string | null
          owner: string | null
          purpose: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_outcome?: string | null
          created_at?: string
          definition_id: string
          id?: string
          known_risks?: string | null
          operational_notes?: string | null
          owner?: string | null
          purpose?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_outcome?: string | null
          created_at?: string
          definition_id?: string
          id?: string
          known_risks?: string | null
          operational_notes?: string | null
          owner?: string | null
          purpose?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      workflow_migrations: {
        Row: {
          actor_user_id: string | null
          definition_id: string
          ended_at: string | null
          from_version_id: string | null
          id: string
          report: Json
          started_at: string
          state: string
          strategy: string
          tenant_id: string
          to_version_id: string
        }
        Insert: {
          actor_user_id?: string | null
          definition_id: string
          ended_at?: string | null
          from_version_id?: string | null
          id?: string
          report?: Json
          started_at?: string
          state?: string
          strategy?: string
          tenant_id: string
          to_version_id: string
        }
        Update: {
          actor_user_id?: string | null
          definition_id?: string
          ended_at?: string | null
          from_version_id?: string | null
          id?: string
          report?: Json
          started_at?: string
          state?: string
          strategy?: string
          tenant_id?: string
          to_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_migrations_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_migrations_from_version_id_fkey"
            columns: ["from_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_migrations_to_version_id_fkey"
            columns: ["to_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_packs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          manifest: Json
          name: string
          required_connectors: string[]
          tenant_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          manifest?: Json
          name: string
          required_connectors?: string[]
          tenant_id?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          manifest?: Json
          name?: string
          required_connectors?: string[]
          tenant_id?: string | null
          version?: number
        }
        Relationships: []
      }
      workflow_published_versions: {
        Row: {
          definition_id: string
          published_at: string
          published_by: string | null
          tenant_id: string
          version_id: string
        }
        Insert: {
          definition_id: string
          published_at?: string
          published_by?: string | null
          tenant_id: string
          version_id: string
        }
        Update: {
          definition_id?: string
          published_at?: string
          published_by?: string | null
          tenant_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_published_versions_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: true
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_published_versions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_rollbacks: {
        Row: {
          compensations: Json
          ended_at: string | null
          id: string
          reason: string | null
          run_id: string
          started_at: string
          state: string
          tenant_id: string | null
          triggered_by: string
        }
        Insert: {
          compensations?: Json
          ended_at?: string | null
          id?: string
          reason?: string | null
          run_id: string
          started_at?: string
          state?: string
          tenant_id?: string | null
          triggered_by: string
        }
        Update: {
          compensations?: Json
          ended_at?: string | null
          id?: string
          reason?: string | null
          run_id?: string
          started_at?: string
          state?: string
          tenant_id?: string | null
          triggered_by?: string
        }
        Relationships: []
      }
      workflow_runs: {
        Row: {
          concurrency_key: string | null
          context: Json
          correlation_id: string | null
          created_at: string
          dag_id: string | null
          duration_ms: number | null
          ended_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          partition_key: string
          payload: Json
          region: string
          result: Json | null
          retry_count: number
          shard_id: number
          started_at: string
          state: string
          status: string
          steps: Json
          tenant_id: string | null
          user_id: string | null
          workflow_id: string | null
          workflow_name: string
          workflow_version_id: string | null
        }
        Insert: {
          concurrency_key?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          dag_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          partition_key?: string
          payload?: Json
          region?: string
          result?: Json | null
          retry_count?: number
          shard_id?: number
          started_at?: string
          state?: string
          status?: string
          steps?: Json
          tenant_id?: string | null
          user_id?: string | null
          workflow_id?: string | null
          workflow_name: string
          workflow_version_id?: string | null
        }
        Update: {
          concurrency_key?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          dag_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          partition_key?: string
          payload?: Json
          region?: string
          result?: Json | null
          retry_count?: number
          shard_id?: number
          started_at?: string
          state?: string
          status?: string
          steps?: Json
          tenant_id?: string | null
          user_id?: string | null
          workflow_id?: string | null
          workflow_name?: string
          workflow_version_id?: string | null
        }
        Relationships: []
      }
      workflow_schedules: {
        Row: {
          consecutive_failures: number
          created_at: string
          created_by: string | null
          cron_expression: string | null
          dag_id: string
          id: string
          interval_seconds: number | null
          last_run_at: string | null
          last_run_id: string | null
          miss_policy: string
          name: string
          next_run_at: string
          payload: Json
          schedule_kind: string
          state: string
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          cron_expression?: string | null
          dag_id: string
          id?: string
          interval_seconds?: number | null
          last_run_at?: string | null
          last_run_id?: string | null
          miss_policy?: string
          name: string
          next_run_at?: string
          payload?: Json
          schedule_kind?: string
          state?: string
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          cron_expression?: string | null
          dag_id?: string
          id?: string
          interval_seconds?: number | null
          last_run_at?: string | null
          last_run_id?: string | null
          miss_policy?: string
          name?: string
          next_run_at?: string
          payload?: Json
          schedule_kind?: string
          state?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_step_runs: {
        Row: {
          attempt: number
          connector: string | null
          connector_response: Json | null
          created_at: string
          dag_node_id: string | null
          duration_ms: number | null
          ended_at: string | null
          error: string | null
          id: string
          idempotency_key: string | null
          inputs: Json
          name: string
          outputs: Json | null
          payload: Json
          result: Json | null
          retry_count: number
          run_id: string
          started_at: string | null
          state: string
          step_index: number
          tenant_id: string | null
        }
        Insert: {
          attempt?: number
          connector?: string | null
          connector_response?: Json | null
          created_at?: string
          dag_node_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          name: string
          outputs?: Json | null
          payload?: Json
          result?: Json | null
          retry_count?: number
          run_id: string
          started_at?: string | null
          state?: string
          step_index: number
          tenant_id?: string | null
        }
        Update: {
          attempt?: number
          connector?: string | null
          connector_response?: Json | null
          created_at?: string
          dag_node_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          name?: string
          outputs?: Json | null
          payload?: Json
          result?: Json | null
          retry_count?: number
          run_id?: string
          started_at?: string | null
          state?: string
          step_index?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_runs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          category_key: string | null
          created_at: string
          featured: boolean
          id: string
          install_count: number
          key: string
          name: string
          publisher: string
          state: string
          summary: string | null
          tags: string[]
        }
        Insert: {
          category_key?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          install_count?: number
          key: string
          name: string
          publisher?: string
          state?: string
          summary?: string | null
          tags?: string[]
        }
        Update: {
          category_key?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          install_count?: number
          key?: string
          name?: string
          publisher?: string
          state?: string
          summary?: string | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "template_categories"
            referencedColumns: ["key"]
          },
        ]
      }
      workflow_validation_reports: {
        Row: {
          errors: Json
          id: string
          ok: boolean
          tenant_id: string
          ts: string
          version_id: string
          warnings: Json
        }
        Insert: {
          errors?: Json
          id?: string
          ok?: boolean
          tenant_id: string
          ts?: string
          version_id: string
          warnings?: Json
        }
        Update: {
          errors?: Json
          id?: string
          ok?: boolean
          tenant_id?: string
          ts?: string
          version_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "workflow_validation_reports_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          definition_id: string
          graph: Json
          id: string
          metadata: Json
          parent_version_id: string | null
          published_at: string | null
          published_by: string | null
          state: string
          tenant_id: string
          validation: Json | null
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          definition_id: string
          graph?: Json
          id?: string
          metadata?: Json
          parent_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          state?: string
          tenant_id: string
          validation?: Json | null
          version: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          definition_id?: string
          graph?: Json
          id?: string
          metadata?: Json
          parent_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          state?: string
          tenant_id?: string
          validation?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aggregate_telemetry: {
        Args: never
        Returns: {
          rows_written: number
        }[]
      }
      archive_old_events: {
        Args: { _older_than_minutes?: number }
        Returns: {
          archived: number
        }[]
      }
      archive_workflow_version: {
        Args: { _operator_uid: string; _version_id: string }
        Returns: undefined
      }
      capture_queue_pressure: { Args: never; Returns: Json }
      capture_worker_capacity: { Args: never; Returns: number }
      claim_due_schedules: {
        Args: { _limit?: number }
        Returns: {
          consecutive_failures: number
          created_at: string
          created_by: string | null
          cron_expression: string | null
          dag_id: string
          id: string
          interval_seconds: number | null
          last_run_at: string | null
          last_run_id: string | null
          miss_policy: string
          name: string
          next_run_at: string
          payload: Json
          schedule_kind: string
          state: string
          tenant_id: string
          timezone: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "workflow_schedules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_next_job: {
        Args: { _worker_id: string }
        Returns: {
          backoff_until: string | null
          completed_at: string | null
          created_at: string
          dag_node_id: string
          error: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          max_retries: number
          partition_key: string
          payload: Json
          priority: number
          priority_class: string
          region: string
          retry_attempt: number
          run_id: string
          scheduled_at: string
          shard_id: number
          started_at: string | null
          state: string
          step_id: string | null
          tenant_id: string | null
          updated_at: string
          worker_id: string | null
          workflow_version_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "workflow_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      connector_allowed: { Args: { _connector: string }; Returns: boolean }
      create_draft_from_version: {
        Args: { _operator_uid: string; _source_version_id: string }
        Returns: string
      }
      create_workflow_definition: {
        Args: {
          _key: string
          _name: string
          _operator_uid: string
          _tenant_id: string
        }
        Returns: string
      }
      current_user_tenants: { Args: never; Returns: string[] }
      detect_sla_breaches: {
        Args: never
        Returns: {
          breached: number
        }[]
      }
      drain_worker:
        | { Args: { _worker_id: string }; Returns: undefined }
        | {
            Args: { _operator_uid: string; _worker_id: string }
            Returns: undefined
          }
      evaluate_circuit_breakers: { Args: never; Returns: number }
      expire_pending_approvals: {
        Args: never
        Returns: {
          expired: number
        }[]
      }
      has_operator_role: {
        Args: {
          _required: Database["glue"]["Enums"]["operator_role"]
          _tenant_id: string
          _uid: string
        }
        Returns: boolean
      }
      has_tenant_access: {
        Args: { _tenant_id: string; _uid: string }
        Returns: boolean
      }
      ingest_trace_span: {
        Args: {
          _attributes: Json
          _correlation_id: string
          _duration_ms: number
          _kind: string
          _name: string
          _parent_span_id: string
          _run_id: string
          _span_id: string
          _status: string
          _step_id: string
          _tenant_id: string
          _trace_id: string
        }
        Returns: string
      }
      pause_partition:
        | {
            Args: { _partition_key: string; _paused?: boolean }
            Returns: undefined
          }
        | {
            Args: {
              _operator_uid: string
              _partition_key: string
              _paused: boolean
            }
            Returns: undefined
          }
      pause_webhook: {
        Args: { _endpoint_id: string; _operator_uid: string; _paused: boolean }
        Returns: undefined
      }
      publish_workflow_version: {
        Args: { _operator_uid: string; _version_id: string }
        Returns: Json
      }
      reconcile_orphans: {
        Args: { _worker_stale_seconds?: number }
        Returns: {
          offline_workers: number
          recovered_jobs: number
        }[]
      }
      record_connector_result: {
        Args: { _connector: string; _ok: boolean }
        Returns: Json
      }
      record_schedule_run: {
        Args: { _run_id: string; _schedule_id: string; _success: boolean }
        Returns: undefined
      }
      reject_approval:
        | {
            Args: { _approval_id: string; _operator: string; _reason?: string }
            Returns: undefined
          }
        | {
            Args: {
              _approval_id: string
              _operator_uid: string
              _reason?: string
            }
            Returns: undefined
          }
      renew_job_lease: {
        Args: { _job_id: string; _seconds?: number; _worker_id: string }
        Returns: boolean
      }
      resume_after_approval:
        | {
            Args: { _approval_id: string; _operator: string }
            Returns: undefined
          }
        | {
            Args: { _approval_id: string; _operator_uid: string }
            Returns: undefined
          }
      rollback_published_version: {
        Args: {
          _definition_id: string
          _operator_uid: string
          _target_version_id: string
        }
        Returns: undefined
      }
      runtime_health_report: { Args: never; Returns: Json }
      set_schedule_state: {
        Args: { _operator_uid: string; _schedule_id: string; _state: string }
        Returns: undefined
      }
      sweep_stale_jobs: {
        Args: { _lease_seconds?: number }
        Returns: {
          recovered: number
        }[]
      }
      validate_workflow_version: {
        Args: { _version_id: string }
        Returns: Json
      }
      worker_shutdown: { Args: { _worker_id: string }; Returns: number }
    }
    Enums: {
      operator_role: "admin" | "operator" | "observer" | "auditor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "glue">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  glue: {
    Enums: {
      operator_role: ["admin", "operator", "observer", "auditor"],
    },
  },
} as const
