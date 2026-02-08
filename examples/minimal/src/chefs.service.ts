import { Injectable } from '@nestjs/common';
import type { Chef } from './types';

const chefs: Chef[] = [
  {
    id: 'mikko',
    name: 'Mikko Virtanen',
    bio: 'Speaks three words per day. Two of them are about salmon. Has been making lohikeitto since before it was trendy. Believes saunas and soups solve most problems.',
    specialty: 'Nordic comfort food',
    origin: 'Helsinki, Finland',
  },
  {
    id: 'georgi',
    name: 'Georgi Alexandrov',
    bio: 'Believes every problem can be solved with yogurt and garlic. Usually right. Once brought tarator to a potluck and converted the entire office.',
    specialty: 'Balkan home cooking',
    origin: 'Sofia, Bulgaria',
  },
  {
    id: 'marco',
    name: 'Marco Rossi',
    bio: 'Will correct your pronunciation and your carbonara. In that order. Has strong opinions about pasta water and even stronger opinions about cream.',
    specialty: 'Italian classics',
    origin: 'Rome, Italy',
  },
];

@Injectable()
export class ChefsService {
  findAll(): Chef[] {
    return chefs;
  }

  findById(id: string): Chef | undefined {
    return chefs.find((c) => c.id === id);
  }
}
