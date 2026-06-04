export interface Project {
  id: string;
  title: string;
  created_at: string;
  done_clean_period?: number | null;
}

export interface Task {
  id: number;
  project_id: string;
  title: string;
  bucket: string;
  position: number;
  tags: string[];
  body: string;
  due_date?: string;
  priority?: string;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

export type BucketName = string;

export interface Bucket {
  name: BucketName;
  title: string;
  subtitle: string;
  position: number;
  color?: string | null;
  layout?: 'list' | 'grid-2' | 'grid-3';
  max_tasks?: number | null;
  is_default?: boolean;
}
