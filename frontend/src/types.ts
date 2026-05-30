export interface Task {
  id: number;
  title: string;
  bucket: string;
  position: number;
  tags: string[];
  body: string;
  created_at: string;
  updated_at: string;
}

export type BucketName = string;

export interface Bucket {
  name: BucketName;
  title: string;
  position: number;
}
