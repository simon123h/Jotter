export interface Project {
  id: string;
  title: string;
  created_at: string;
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
  created_at: string;
  updated_at: string;
}

export type BucketName = string;

export interface Bucket {
  name: BucketName;
  title: string;
  subtitle: string;
  position: number;
}
