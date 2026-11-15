import { RelationshipMemory } from './types';

const STORAGE_KEY = 'maya_relationship_memory';

const DEFAULT_MEMORY: RelationshipMemory = {
  approved: true,
  nicknames: ['Sirius', 'Chief'],
  insideJokes: [
    'Coffee is not a substitute for 8 hours of REM sleep, Sirius.',
    'ScantriX ports: checking perimeter before someone else knocks.',
    'Bishop Heber College exams vs. ASC client deadlines.',
  ],
  milestones: [
    {
      id: 'm-1',
      title: 'AttendLink & BSDCAS Attendance',
      date: '2025-2026',
      note: 'Automated campus attendance pipelines with Hari Vishnu & Nufail.',
    },
    {
      id: 'm-2',
      title: 'PONNI MUN 3.0 Web Portal',
      date: '2026',
      note: 'Staged registration portal for delegate onboarding.',
    },
    {
      id: 'm-3',
      title: 'Beginner CTF & Workshop Lab',
      date: '2026',
      note: 'Containerized forensics and steganography challenges.',
    },
  ],
  favoriteThings: [
    { id: 'f-1', category: 'tools', value: 'Bolt.new, Lovable, v0.dev, Kali Linux' },
    { id: 'f-2', category: 'aesthetic', value: 'Matte black cyberpunk, eDEX-UI holographic HUD' },
    { id: 'f-3', category: 'location', value: 'Trichy, Tamil Nadu' },
  ],
};

class RelationshipMemoryStore {
  private memory: RelationshipMemory;

  constructor() {
    this.memory = this.loadMemory();
  }

  private loadMemory(): RelationshipMemory {
    if (typeof localStorage === 'undefined') return DEFAULT_MEMORY;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          approved: parsed.approved ?? DEFAULT_MEMORY.approved,
          nicknames: Array.isArray(parsed.nicknames) ? parsed.nicknames : DEFAULT_MEMORY.nicknames,
          insideJokes: Array.isArray(parsed.insideJokes) ? parsed.insideJokes : DEFAULT_MEMORY.insideJokes,
          milestones: Array.isArray(parsed.milestones) ? parsed.milestones : DEFAULT_MEMORY.milestones,
          favoriteThings: Array.isArray(parsed.favoriteThings) ? parsed.favoriteThings : DEFAULT_MEMORY.favoriteThings,
        };
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_MEMORY;
  }

  public saveMemory(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memory));
    } catch (e) {
      // ignore
    }
  }

  public getMemory(): RelationshipMemory {
    return { ...this.memory };
  }

  public addNickname(name: string): void {
    const trimmed = name.trim();
    if (trimmed && !this.memory.nicknames.includes(trimmed)) {
      this.memory.nicknames.push(trimmed);
      this.saveMemory();
    }
  }

  public addMilestone(title: string, note: string): void {
    this.memory.milestones.push({
      id: `m-${Date.now()}`,
      title: title.trim(),
      date: new Date().toLocaleDateString(),
      note: note.trim(),
    });
    this.saveMemory();
  }

  public addInsideJoke(joke: string): void {
    this.memory.insideJokes.push(joke.trim());
    this.saveMemory();
  }

  /**
   * "Forget that": Remove a memory matching a keyword or phrase
   */
  public forgetItem(query: string): boolean {
    const q = query.toLowerCase().trim();
    let found = false;

    // Check nicknames
    const nLen = this.memory.nicknames.length;
    this.memory.nicknames = this.memory.nicknames.filter((n) => !n.toLowerCase().includes(q));
    if (this.memory.nicknames.length < nLen) found = true;

    // Check jokes
    const jLen = this.memory.insideJokes.length;
    this.memory.insideJokes = this.memory.insideJokes.filter((j) => !j.toLowerCase().includes(q));
    if (this.memory.insideJokes.length < jLen) found = true;

    // Check milestones
    const mLen = this.memory.milestones.length;
    this.memory.milestones = this.memory.milestones.filter(
      (m) => !m.title.toLowerCase().includes(q) && !m.note.toLowerCase().includes(q)
    );
    if (this.memory.milestones.length < mLen) found = true;

    // Check favorites
    const fLen = this.memory.favoriteThings.length;
    this.memory.favoriteThings = this.memory.favoriteThings.filter(
      (f) => !f.value.toLowerCase().includes(q) && !f.category.toLowerCase().includes(q)
    );
    if (this.memory.favoriteThings.length < fLen) found = true;

    if (found) {
      this.saveMemory();
    }
    return found;
  }

  /**
   * "Forget everything" / Wipe Memory: completely clear relationship memories
   */
  public wipeEverything(): void {
    this.memory = {
      approved: false,
      nicknames: ['Sirius'],
      insideJokes: [],
      milestones: [],
      favoriteThings: [],
    };
    this.saveMemory();
  }
}

export const relationshipMemoryStore = new RelationshipMemoryStore();
