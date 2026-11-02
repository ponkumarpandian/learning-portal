/**
 * Subject lesson queues — SPEC §9.2 (minimal).
 *
 * Each subject has an ordered queue of its approved chapters' lessons: chapters in
 * `plan.chapterOrder[subject]` order (unlisted chapters after them), then by `chapter.order`.
 * Chapters already taught in school (`plan.taughtAlready`) skip the queue (they go to revision).
 * A slot takes the first lesson not yet completed, so a missed lesson stays at the front.
 */
import type { Chapter, Lesson, Plan } from '@/content';

export interface QueuedLesson {
  lesson: Lesson;
  chapter: Chapter;
}

/** All queued lessons for a subject, in order. */
export function subjectQueue(chapters: Chapter[], plan: Plan, subject: string): QueuedLesson[] {
  const listed = plan.chapterOrder[subject] ?? [];
  const taught = new Set(plan.taughtAlready);
  const rank = (c: Chapter): number => {
    const i = listed.indexOf(c.id);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };

  return chapters
    .filter((c) => c.subject === subject && c.status === 'approved' && !taught.has(c.id))
    .sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra < rb ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .flatMap((chapter) => chapter.lessons.map((lesson) => ({ lesson, chapter })));
}

/** The first lesson in the subject's queue that is not completed yet. */
export function nextLesson(
  chapters: Chapter[],
  plan: Plan,
  subject: string,
  completed: ReadonlySet<string>,
): QueuedLesson | undefined {
  return subjectQueue(chapters, plan, subject).find((q) => !completed.has(q.lesson.id));
}

/** Find a lesson (and its chapter) by id across all chapters, drafts included. */
export function findLesson(chapters: Chapter[], lessonId: string): QueuedLesson | undefined {
  for (const chapter of chapters) {
    const lesson = chapter.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, chapter };
  }
  return undefined;
}
