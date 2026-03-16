export type Domain = 'legal' | 'finance' | 'medical';

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  links?: { uri: string; title: string }[];
}

export interface DomainConfig {
  id: Domain;
  name: string;
  icon: string;
  description: string;
  color: string;
  systemInstruction: string;
  suggestions: string[];
}
