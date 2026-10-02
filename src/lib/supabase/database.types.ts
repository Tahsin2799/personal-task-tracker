
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity": {
                  Row: {
                    "actor_id": string | null,"board_id": string,"created_at": string,"data": NonNullable<Json>,"id": number,"kind": string,"task_id": string | null
                  }
                  Insert: {
                    "actor_id"?: string | null,"board_id": string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"kind": string,"task_id"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"board_id"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"kind"?: string,"task_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "board_id": string,"created_at": string,"id": string,"mime": string | null,"name": string,"path": string,"size": number,"task_id": string,"uploader_id": string | null
                  }
                  Insert: {
                    "board_id": string,"created_at"?: string,"id"?: string,"mime"?: string | null,"name": string,"path": string,"size"?: number,"task_id": string,"uploader_id"?: string | null
                  }
                  Update: {
                    "board_id"?: string,"created_at"?: string,"id"?: string,"mime"?: string | null,"name"?: string,"path"?: string,"size"?: number,"task_id"?: string,"uploader_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_board_id_task_id_fkey"
      columns: ["board_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["board_id","id"]
    },{
      foreignKeyName: "attachments_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"board_columns": {
                  Row: {
                    "board_id": string,"category": Database["public"]['Enums']["column_category"],"created_at": string,"id": string,"name": string,"position": string,"wip_limit": number | null
                  }
                  Insert: {
                    "board_id": string,"category"?: Database["public"]['Enums']["column_category"],"created_at"?: string,"id"?: string,"name": string,"position": string,"wip_limit"?: number | null
                  }
                  Update: {
                    "board_id"?: string,"category"?: Database["public"]['Enums']["column_category"],"created_at"?: string,"id"?: string,"name"?: string,"position"?: string,"wip_limit"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "board_columns_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id"]
    }
                  ]
                },"boards": {
                  Row: {
                    "archived_at": string | null,"color": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"key": string,"name": string,"next_task_number": number,"workspace_id": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"key": string,"name": string,"next_task_number"?: number,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"key"?: string,"name"?: string,"next_task_number"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "boards_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boards_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"board_id": string,"body": string,"created_at": string,"edited_at": string | null,"id": string,"task_id": string
                  }
                  Insert: {
                    "author_id"?: string,"board_id": string,"body": string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"task_id": string
                  }
                  Update: {
                    "author_id"?: string,"board_id"?: string,"body"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_board_id_task_id_fkey"
      columns: ["board_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["board_id","id"]
    }
                  ]
                },"labels": {
                  Row: {
                    "board_id": string,"color": string,"id": string,"name": string
                  }
                  Insert: {
                    "board_id": string,"color": string,"id"?: string,"name": string
                  }
                  Update: {
                    "board_id"?: string,"color"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "labels_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"board_id": string | null,"created_at": string,"data": NonNullable<Json>,"id": number,"kind": string,"read_at": string | null,"task_id": string | null,"user_id": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"board_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"kind": string,"read_at"?: string | null,"task_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"board_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"kind"?: string,"read_at"?: string | null,"task_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"email": string,"id": string,"onboarded_at": string | null
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"email": string,"id": string,"onboarded_at"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"email"?: string,"id"?: string,"onboarded_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"sprints": {
                  Row: {
                    "board_id": string,"committed_points": number | null,"completed_at": string | null,"created_at": string,"end_date": string | null,"goal": string | null,"id": string,"name": string,"start_date": string | null,"status": Database["public"]['Enums']["sprint_status"]
                  }
                  Insert: {
                    "board_id": string,"committed_points"?: number | null,"completed_at"?: string | null,"created_at"?: string,"end_date"?: string | null,"goal"?: string | null,"id"?: string,"name": string,"start_date"?: string | null,"status"?: Database["public"]['Enums']["sprint_status"]
                  }
                  Update: {
                    "board_id"?: string,"committed_points"?: number | null,"completed_at"?: string | null,"created_at"?: string,"end_date"?: string | null,"goal"?: string | null,"id"?: string,"name"?: string,"start_date"?: string | null,"status"?: Database["public"]['Enums']["sprint_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "sprints_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id"]
    }
                  ]
                },"task_labels": {
                  Row: {
                    "board_id": string,"label_id": string,"task_id": string
                  }
                  Insert: {
                    "board_id": string,"label_id": string,"task_id": string
                  }
                  Update: {
                    "board_id"?: string,"label_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_labels_board_id_label_id_fkey"
      columns: ["board_id","label_id"]
isOneToOne: false
      referencedRelation: "labels"
      referencedColumns: ["board_id","id"]
    },{
      foreignKeyName: "task_labels_board_id_task_id_fkey"
      columns: ["board_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["board_id","id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "archived_at": string | null,"assignee_id": string | null,"board_id": string,"column_id": string,"completed_at": string | null,"cover_attachment_id": string | null,"created_at": string,"description": string | null,"due_date": string | null,"epic_id": string | null,"experiment": Json | null,"id": string,"milestone": boolean,"number": number,"parent_id": string | null,"position": string,"priority": Database["public"]['Enums']["task_priority"],"reporter_id": string | null,"search": unknown,"sprint_id": string | null,"start_date": string | null,"story_points": number | null,"title": string,"type": Database["public"]['Enums']["task_type"],"updated_at": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"assignee_id"?: string | null,"board_id": string,"column_id": string,"completed_at"?: string | null,"cover_attachment_id"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"epic_id"?: string | null,"experiment"?: Json | null,"id"?: string,"milestone"?: boolean,"number": number,"parent_id"?: string | null,"position": string,"priority"?: Database["public"]['Enums']["task_priority"],"reporter_id"?: string | null,"search"?: never,"sprint_id"?: string | null,"start_date"?: string | null,"story_points"?: number | null,"title": string,"type"?: Database["public"]['Enums']["task_type"],"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"assignee_id"?: string | null,"board_id"?: string,"column_id"?: string,"completed_at"?: string | null,"cover_attachment_id"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"epic_id"?: string | null,"experiment"?: Json | null,"id"?: string,"milestone"?: boolean,"number"?: number,"parent_id"?: string | null,"position"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"reporter_id"?: string | null,"search"?: never,"sprint_id"?: string | null,"start_date"?: string | null,"story_points"?: number | null,"title"?: string,"type"?: Database["public"]['Enums']["task_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_board_id_column_id_fkey"
      columns: ["board_id","column_id"]
isOneToOne: false
      referencedRelation: "board_columns"
      referencedColumns: ["board_id","id"]
    },{
      foreignKeyName: "tasks_board_id_epic_id_fkey"
      columns: ["board_id","epic_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["board_id","id"]
    },{
      foreignKeyName: "tasks_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_board_id_parent_id_fkey"
      columns: ["board_id","parent_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["board_id","id"]
    },{
      foreignKeyName: "tasks_board_id_sprint_id_fkey"
      columns: ["board_id","sprint_id"]
isOneToOne: false
      referencedRelation: "sprints"
      referencedColumns: ["board_id","id"]
    },{
      foreignKeyName: "tasks_cover_attachment_id_fkey"
      columns: ["cover_attachment_id"]
isOneToOne: false
      referencedRelation: "attachments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "joined_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  Insert: {
                    "joined_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "joined_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"is_personal": boolean,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"is_personal"?: boolean,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"is_personal"?: boolean,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "complete_sprint":
{ Args: { "carry_to": string,"sprint": string }; Returns: number
                           },
"search_entries":
{ Args: { "q": string }; Returns: {
              "board_id": string,"board_key": string,"board_name": string,"completed_at": string,"id": string,"number": number,"title": string,"type": Database["public"]['Enums']["task_type"]
            }[]
                           },
"start_sprint":
{ Args: { "ends": string,"sprint": string,"sprint_goal": string,"starts": string }; Returns: undefined
                           }
          }
          Enums: {
            "column_category": "todo"|"in_progress"|"done","sprint_status": "planned"|"active"|"completed","task_priority": "lowest"|"low"|"medium"|"high"|"highest","task_type": "epic"|"story"|"task"|"bug"|"subtask","workspace_role": "owner"|"admin"|"member"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "column_category": ["todo", "in_progress", "done"],"sprint_status": ["planned", "active", "completed"],"task_priority": ["lowest", "low", "medium", "high", "highest"],"task_type": ["epic", "story", "task", "bug", "subtask"],"workspace_role": ["owner", "admin", "member"]
          }
        }
} as const
