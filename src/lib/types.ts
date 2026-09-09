import type { Timestamp } from 'firebase/firestore';

export type Student = {
  id?: string;
  name: string;
  parentName: string;
};

export type ContributionRequest = {
  id?: string;
  title: string;
  description: string;
  amount: number;
  createdAt?: Timestamp | object;
};

export type Contribution = {
  id?: string;
  studentId: string;
  studentName: string;
  requestId: string;
  requestTitle: string;
  amount: number;
  date: Timestamp | object;
};

export type Expense = {
  id?: string;
  description: string;
  amount: number;
  date: Timestamp | object;
};

export type User = {
  id?: string;
  name: string;
  accessCode: string;
}

export type LogEntry = {
    id?: string;
    timestamp: Timestamp | object;
    user: string;
    action: string;
    type: 'income' | 'expense' | 'student' | 'request' | 'system';
};

export type SampleData = {
  students: Omit<Student, 'id'>[];
  contributionRequests: Omit<ContributionRequest, 'id'>[];
  expenses: Omit<Expense, 'id' | 'date'>[];
};

export type AppSettings = {
  id?: 'app_settings'; // Singleton document
  pwaLogoUrl?: string;
};
