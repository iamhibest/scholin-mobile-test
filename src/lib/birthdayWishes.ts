import { supabase } from './supabase';

export type ChildWish = { student_id: string; student_name: string; school_name: string; director_name: string; turning: number };

// The parent's children who are celebrating today. Empty on every other day.
export async function fetchChildBirthdayWishes(): Promise<ChildWish[]> {
  const { data, error } = await supabase.rpc('get_child_birthday_wishes');
  if (error) {
    throw new Error(error.message || 'Could not load birthday wishes.');
  }
  return (data || []) as ChildWish[];
}

export function joinNames(names: string[]) {
  if (names.length <= 1) {
    return names.join('');
  }
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

// The greeting a parent reads. It is written as if it came from the school.
export function parentGreeting(wishes: ChildWish[]) {
  const names = wishes.map(w => w.student_name);
  const school = wishes[0].school_name;
  const director = wishes[0].director_name;
  const many = wishes.length > 1;
  const who = joinNames(names);
  const lines = [
    'Happy Birthday, ' + who + '!',
    '',
    'Today is a special day, and the whole ' + school + ' family is celebrating ' + (many ? 'you.' : 'you.'),
    '',
    'We thank God for the gift of your ' + (many ? 'lives' : 'life') + ' and for the joy you bring to our school every day. May you enjoy long life, good health, wisdom and prosperity. May every door you knock on open, and may you keep growing in knowledge, kindness and strength until every good dream you carry comes true.',
    '',
    'To the dear parents, congratulations on this beautiful milestone. Thank you for trusting us with ' + (many ? 'your children' : who) + '. We pray that you will have many more happy years to celebrate together.',
    '',
    'With love and best wishes,',
  ];
  return { title: 'Happy Birthday, ' + who + '!', body: lines.slice(2).join('\n'), from: (director ? director + '\nDirector, ' : '') + school };
}

// Short line for the dashboard banner.
export function parentBannerLine(wishes: ChildWish[]) {
  const who = joinNames(wishes.map(w => w.student_name));
  const school = wishes[0].school_name;
  const director = wishes[0].director_name;
  return 'Happy birthday, ' + who + '! Long life and prosperity. From ' + (director ? director + ', ' : '') + school + '.';
}

export function staffAdvice(count: number, today: boolean) {
  const these = count === 1 ? 'this child' : 'this set of students';
  const them = count === 1 ? 'them' : 'them';
  if (today) {
    return {
      wish: 'Happy birthday to ' + these + '. Long life and prosperity. Kindly celebrate ' + them + ' and wish ' + them + ' well today.',
      tips: [
        'Announce the birthday at the morning assembly and let everyone sing happy birthday to ' + them + '.',
        'Ask the class teacher to say a few kind words, and let classmates wish ' + them + ' well.',
        'Pray for ' + them + ' and wish ' + them + ' long life, good health and success in their studies.',
        'Send your own wishes to ' + (count === 1 ? 'the parents' : 'the parents') + ' as well. A short call or message to congratulate them goes a long way.',
        'Keep it simple and joyful. A small celebration like a song, a clap or a card makes a child feel valued.',
      ],
    };
  }
  return {
    wish: 'Tomorrow is the birthday of ' + these + '. Get ready to celebrate ' + them + '.',
    tips: [
      'Plan to announce the birthday at tomorrow\'s morning assembly.',
      'Let the class teacher know so classmates can prepare to wish ' + them + ' well.',
      'Think of a small, simple way to make the day special for ' + them + '.',
    ],
  };
}
