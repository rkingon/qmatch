import { describe, expect, it } from "vitest";
import { explain, match } from "./index";

// =============================================================================
// Types
// =============================================================================

interface Artist {
  id: number;
  name: string;
  country: string;
  monthlyListeners: number;
  verified: boolean;
  genres: string[];
}

interface Album {
  id: number;
  title: string;
  artist: Artist;
  releaseDate: Date;
  trackCount: number;
  label: string | null;
}

interface Song {
  id: number;
  title: string;
  genre: "rock" | "electronic" | "jazz" | "classical" | "hip-hop" | "pop";
  durationMs: number;
  plays: number;
  explicit: boolean;
  album: Album | null;
}

interface Playlist {
  id: number;
  name: string;
  isPublic: boolean;
  createdAt: Date;
  followerCount: number;
  featuredSong: Song | null;
}

// =============================================================================
// Sample Data
// =============================================================================

const radiohead: Artist = {
  id: 1,
  name: "Radiohead",
  country: "UK",
  monthlyListeners: 25_000_000,
  verified: true,
  genres: ["rock", "electronic", "alternative"],
};

const okComputer: Album = {
  id: 1,
  title: "OK Computer",
  artist: radiohead,
  releaseDate: new Date("1997-05-21"),
  trackCount: 12,
  label: "Parlophone",
};

const paranoidAndroid: Song = {
  id: 1,
  title: "Paranoid Android",
  genre: "rock",
  durationMs: 386_000,
  plays: 500_000_000,
  explicit: false,
  album: okComputer,
};

const sampleSongs: Song[] = [
  paranoidAndroid,
  {
    id: 2,
    title: "Karma Police",
    genre: "rock",
    durationMs: 264_000,
    plays: 800_000_000,
    explicit: false,
    album: okComputer,
  },
  {
    id: 3,
    title: "Untitled Beat",
    genre: "electronic",
    durationMs: 180_000,
    plays: 50_000,
    explicit: true,
    album: null, // Single, no album
  },
];

const samplePlaylists: Playlist[] = [
  {
    id: 1,
    name: "90s Classics",
    isPublic: true,
    createdAt: new Date("2020-01-15"),
    followerCount: 150_000,
    featuredSong: paranoidAndroid,
  },
  {
    id: 2,
    name: "My Private Mix",
    isPublic: false,
    createdAt: new Date("2023-06-01"),
    followerCount: 0,
    featuredSong: sampleSongs[2],
  },
  {
    id: 3,
    name: "Empty Playlist",
    isPublic: true,
    createdAt: new Date("2024-01-01"),
    followerCount: 10,
    featuredSong: null,
  },
];

// =============================================================================
// Tests
// =============================================================================

describe("match", () => {
  describe("simple equality (implicit $eq)", () => {
    it("matches exact value", () => {
      const isRock = match<Song>({ genre: "rock" });
      expect(isRock(paranoidAndroid)).toBe(true);
    });

    it("does not match different value", () => {
      const isJazz = match<Song>({ genre: "jazz" });
      expect(isJazz(paranoidAndroid)).toBe(false);
    });

    it("matches boolean value", () => {
      const isExplicit = match<Song>({ explicit: true });
      expect(isExplicit(paranoidAndroid)).toBe(false);
      expect(isExplicit(sampleSongs[2])).toBe(true);
    });
  });

  describe("comparison operators", () => {
    it("$gte matches greater or equal", () => {
      const popular = match<Song>({ plays: { $gte: 100_000_000 } });
      expect(popular(paranoidAndroid)).toBe(true);
    });

    it("$gte matches equal", () => {
      const exactPlays = match<Song>({ plays: { $gte: 500_000_000 } });
      expect(exactPlays(paranoidAndroid)).toBe(true);
    });

    it("$gte does not match less than", () => {
      const veryPopular = match<Song>({ plays: { $gte: 1_000_000_000 } });
      expect(veryPopular(paranoidAndroid)).toBe(false);
    });

    it("$lte matches less or equal", () => {
      const shortSong = match<Song>({ durationMs: { $lte: 400_000 } });
      expect(shortSong(paranoidAndroid)).toBe(true);
    });

    it("$gt matches greater than", () => {
      const overSixMinutes = match<Song>({ durationMs: { $gt: 360_000 } });
      expect(overSixMinutes(paranoidAndroid)).toBe(true);
    });

    it("$lt matches less than", () => {
      const underTenMinutes = match<Song>({ durationMs: { $lt: 600_000 } });
      expect(underTenMinutes(paranoidAndroid)).toBe(true);
    });

    it("combines $gte and $lte for range", () => {
      const midLength = match<Song>({
        durationMs: { $gte: 180_000, $lte: 420_000 },
      });
      expect(midLength(paranoidAndroid)).toBe(true);
    });
  });

  describe("$in operator", () => {
    it("matches value in array", () => {
      const rockOrElectronic = match<Song>({
        genre: { $in: ["rock", "electronic"] },
      });
      expect(rockOrElectronic(paranoidAndroid)).toBe(true);
    });

    it("does not match value not in array", () => {
      const jazzOrClassical = match<Song>({
        genre: { $in: ["jazz", "classical"] },
      });
      expect(jazzOrClassical(paranoidAndroid)).toBe(false);
    });
  });

  describe("$nin operator", () => {
    it("matches value not in array", () => {
      const notPopOrHipHop = match<Song>({
        genre: { $nin: ["pop", "hip-hop"] },
      });
      expect(notPopOrHipHop(paranoidAndroid)).toBe(true);
    });

    it("does not match value in array", () => {
      const notRock = match<Song>({
        genre: { $nin: ["rock", "classical"] },
      });
      expect(notRock(paranoidAndroid)).toBe(false);
    });
  });

  describe("$ne operator", () => {
    it("matches when not equal", () => {
      const notElectronic = match<Song>({ genre: { $ne: "electronic" } });
      expect(notElectronic(paranoidAndroid)).toBe(true);
    });

    it("does not match when equal", () => {
      const notRock = match<Song>({ genre: { $ne: "rock" } });
      expect(notRock(paranoidAndroid)).toBe(false);
    });
  });

  describe("multiple conditions (implicit AND)", () => {
    it("matches when all conditions true", () => {
      const popularRock = match<Song>({
        genre: "rock",
        plays: { $gte: 100_000_000 },
      });
      expect(popularRock(paranoidAndroid)).toBe(true);
    });

    it("does not match when one condition false", () => {
      const popularJazz = match<Song>({
        genre: "jazz",
        plays: { $gte: 100_000_000 },
      });
      expect(popularJazz(paranoidAndroid)).toBe(false);
    });
  });

  describe("nested object queries", () => {
    it("matches nested field", () => {
      const bigArtist = match<Song>({
        album: {
          artist: {
            monthlyListeners: { $gte: 10_000_000 },
          },
        },
      });
      expect(bigArtist(paranoidAndroid)).toBe(true);
    });

    it("does not match when nested field fails", () => {
      const hugeArtist = match<Song>({
        album: {
          artist: {
            monthlyListeners: { $gte: 100_000_000 },
          },
        },
      });
      expect(hugeArtist(paranoidAndroid)).toBe(false);
    });

    it("does not match when parent is null", () => {
      const hasAlbum = match<Song>({
        album: {
          trackCount: { $gte: 1 },
        },
      });
      expect(hasAlbum(sampleSongs[2])).toBe(false); // Single with no album
    });

    it("matches deeply nested string", () => {
      const ukArtist = match<Song>({
        album: {
          artist: {
            country: "UK",
          },
        },
      });
      expect(ukArtist(paranoidAndroid)).toBe(true);
    });
  });

  describe("$or operator", () => {
    it("matches when any condition true", () => {
      const popularOrVerified = match<Song>({
        $or: [
          { plays: { $gte: 1_000_000_000 } },
          { album: { artist: { verified: true } } },
        ],
      });
      expect(popularOrVerified(paranoidAndroid)).toBe(true);
    });

    it("does not match when all conditions false", () => {
      const billionPlaysOrUs = match<Song>({
        $or: [
          { plays: { $gte: 1_000_000_000 } },
          { album: { artist: { country: "US" } } },
        ],
      });
      expect(billionPlaysOrUs(paranoidAndroid)).toBe(false);
    });

    it("returns false for empty $or", () => {
      const empty = match<Song>({ $or: [] });
      expect(empty(paranoidAndroid)).toBe(false);
    });
  });

  describe("$and operator", () => {
    it("matches when all conditions true", () => {
      const popularAndLong = match<Song>({
        $and: [
          { plays: { $gte: 100_000_000 } },
          { durationMs: { $gte: 300_000 } },
        ],
      });
      expect(popularAndLong(paranoidAndroid)).toBe(true);
    });

    it("does not match when any condition false", () => {
      const popularAndShort = match<Song>({
        $and: [
          { plays: { $gte: 100_000_000 } },
          { durationMs: { $lt: 200_000 } },
        ],
      });
      expect(popularAndShort(paranoidAndroid)).toBe(false);
    });

    it("returns true for empty $and", () => {
      const empty = match<Song>({ $and: [] });
      expect(empty(paranoidAndroid)).toBe(true);
    });
  });

  describe("$not operator", () => {
    it("negates a matching query", () => {
      const notUnpopular = match<Song>({
        $not: { plays: { $lt: 1_000_000 } },
      });
      expect(notUnpopular(paranoidAndroid)).toBe(true);
    });

    it("negates a non-matching query", () => {
      const notPopular = match<Song>({
        $not: { plays: { $gte: 100_000_000 } },
      });
      expect(notPopular(paranoidAndroid)).toBe(false);
    });
  });

  describe("$exists operator", () => {
    it("$exists: true matches non-null", () => {
      const hasAlbum = match<Song>({ album: { $exists: true } });
      expect(hasAlbum(sampleSongs[0])).toBe(true);
      expect(hasAlbum(sampleSongs[2])).toBe(false);
    });

    it("$exists: false matches null", () => {
      const isSingle = match<Song>({ album: { $exists: false } });
      expect(isSingle(sampleSongs[0])).toBe(false);
      expect(isSingle(sampleSongs[2])).toBe(true);
    });

    it("$exists on nullable nested field", () => {
      const hasLabel = match<Album>({ label: { $exists: true } });
      expect(hasLabel(okComputer)).toBe(true);

      const noLabel: Album = { ...okComputer, label: null };
      expect(hasLabel(noLabel)).toBe(false);
    });

    it("$exists in playlist context", () => {
      const hasFeatured = match<Playlist>({ featuredSong: { $exists: true } });
      expect(hasFeatured(samplePlaylists[0])).toBe(true);
      expect(hasFeatured(samplePlaylists[2])).toBe(false);
    });
  });

  describe("$contains operator (arrays)", () => {
    it("matches when array contains value", () => {
      const hasRock = match<Artist>({
        genres: { $contains: "rock" },
      });
      expect(hasRock(radiohead)).toBe(true);
    });

    it("does not match when array does not contain value", () => {
      const hasCountry = match<Artist>({
        genres: { $contains: "country" },
      });
      expect(hasCountry(radiohead)).toBe(false);
    });

    it("works with nested array fields", () => {
      const artistHasElectronic = match<Song>({
        album: {
          artist: {
            genres: { $contains: "electronic" },
          },
        },
      });
      expect(artistHasElectronic(paranoidAndroid)).toBe(true);
    });
  });

  describe("$size operator (arrays)", () => {
    it("matches exact array length", () => {
      const hasThreeGenres = match<Artist>({
        genres: { $size: 3 },
      });
      expect(hasThreeGenres(radiohead)).toBe(true); // ["rock", "electronic", "alternative"]
    });

    it("does not match wrong length", () => {
      const hasTwoGenres = match<Artist>({
        genres: { $size: 2 },
      });
      expect(hasTwoGenres(radiohead)).toBe(false);
    });

    it("combines with $contains", () => {
      const rockWithThreeGenres = match<Artist>({
        genres: { $contains: "rock", $size: 3 },
      });
      expect(rockWithThreeGenres(radiohead)).toBe(true);
    });
  });

  describe("$regex operator", () => {
    it("matches with RegExp", () => {
      const startsWithPara = match<Song>({
        title: { $regex: /^Paranoid/i },
      });
      expect(startsWithPara(paranoidAndroid)).toBe(true);
    });

    it("matches with string pattern", () => {
      const containsAndroid = match<Song>({
        title: { $regex: "Android" },
      });
      expect(containsAndroid(paranoidAndroid)).toBe(true);
    });

    it("does not match non-matching pattern", () => {
      const containsLove = match<Song>({
        title: { $regex: /love/i },
      });
      expect(containsLove(paranoidAndroid)).toBe(false);
    });

    it("matches artist name pattern", () => {
      const headBands = match<Song>({
        album: {
          artist: {
            name: { $regex: /head$/i },
          },
        },
      });
      expect(headBands(paranoidAndroid)).toBe(true);
    });
  });

  describe("$fn custom function (field-level)", () => {
    it("matches when function returns true", () => {
      const evenDuration = match<Song>({
        durationMs: { $fn: (ms) => ms % 1000 === 0 },
      });
      expect(evenDuration(paranoidAndroid)).toBe(true);
    });

    it("does not match when function returns false", () => {
      const exactlyFiveMin = match<Song>({
        durationMs: { $fn: (ms) => ms === 300_000 },
      });
      expect(exactlyFiveMin(paranoidAndroid)).toBe(false);
    });

    it("combines with other operators", () => {
      const longAndEven = match<Song>({
        durationMs: { $gte: 300_000, $fn: (ms) => ms % 1000 === 0 },
      });
      expect(longAndEven(paranoidAndroid)).toBe(true);
    });
  });

  describe("$where custom function (query-level)", () => {
    it("matches when function returns true", () => {
      const highPlayRate = match<Song>({
        $where: (song) => {
          if (!song.album) return false;
          const playsPerTrack = song.plays / song.album.trackCount;
          return playsPerTrack > 10_000_000;
        },
      });
      expect(highPlayRate(paranoidAndroid)).toBe(true);
    });

    it("does not match when function returns false", () => {
      const isRemix = match<Song>({
        $where: (song) => song.title.toLowerCase().includes("remix"),
      });
      expect(isRemix(paranoidAndroid)).toBe(false);
    });

    it("combines with other matchers", () => {
      const popularRockOverFiveMin = match<Song>({
        genre: "rock",
        plays: { $gte: 100_000_000 },
        $where: (song) => song.durationMs > 300_000, // Over 5 minutes
      });
      expect(popularRockOverFiveMin(paranoidAndroid)).toBe(true); // 386s > 300s
    });
  });

  describe("Date comparisons", () => {
    it("$gte matches dates", () => {
      const modernAlbum = match<Album>({
        releaseDate: { $gte: new Date("2000-01-01") },
      });
      expect(modernAlbum(okComputer)).toBe(false); // 1997
    });

    it("$lt matches dates", () => {
      const before2000 = match<Album>({
        releaseDate: { $lt: new Date("2000-01-01") },
      });
      expect(before2000(okComputer)).toBe(true); // 1997
    });

    it("date range query", () => {
      const the90s = match<Album>({
        releaseDate: {
          $gte: new Date("1990-01-01"),
          $lt: new Date("2000-01-01"),
        },
      });
      expect(the90s(okComputer)).toBe(true);
    });

    it("works with playlist dates", () => {
      const recentPlaylist = match<Playlist>({
        createdAt: { $gte: new Date("2023-01-01") },
      });
      expect(recentPlaylist(samplePlaylists[0])).toBe(false); // 2020
      expect(recentPlaylist(samplePlaylists[1])).toBe(true); // 2023
    });
  });

  describe("array filtering", () => {
    it("works with Array.filter()", () => {
      const hasAlbum = match<Song>({ album: { $exists: true } });
      const result = sampleSongs.filter(hasAlbum);
      expect(result).toHaveLength(2);
    });

    it("filters by nested criteria", () => {
      const fromUk = match<Song>({
        album: {
          artist: {
            country: "UK",
          },
        },
      });
      const result = sampleSongs.filter(fromUk);
      expect(result).toHaveLength(2);
    });

    it("filters playlists by follower count", () => {
      const hasFollowers = match<Playlist>({
        followerCount: { $gte: 10 },
      });
      const result = samplePlaylists.filter(hasFollowers);
      expect(result).toHaveLength(2); // 150k and 10
    });

    it("complex filter chain", () => {
      const publicWithFeature = match<Playlist>({
        isPublic: true,
        featuredSong: { $exists: true },
      });
      const result = samplePlaylists.filter(publicWithFeature);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("90s Classics");
    });
  });

  describe("complex combined queries", () => {
    it("playlist curation query", () => {
      const curatedPlaylist = match<Playlist>({
        isPublic: true,
        followerCount: { $gte: 1000 },
        featuredSong: { $exists: true },
        $where: (p) => p.name.length > 5,
      });
      expect(curatedPlaylist(samplePlaylists[0])).toBe(true);
    });

    it("viral song detection", () => {
      const viralSong = match<Song>({
        plays: { $gte: 100_000_000 },
        explicit: false,
        album: {
          artist: {
            verified: true,
            monthlyListeners: { $gte: 1_000_000 },
          },
        },
      });
      expect(viralSong(paranoidAndroid)).toBe(true);
    });

    it("discovery query with $or", () => {
      const discoverable = match<Song>({
        $or: [
          { plays: { $lt: 1_000_000 }, genre: "electronic" },
          { album: { artist: { monthlyListeners: { $lt: 100_000 } } } },
        ],
      });
      expect(discoverable(sampleSongs[2])).toBe(true); // Low-play electronic
      expect(discoverable(paranoidAndroid)).toBe(false); // Too popular
    });

    it("90s rock classic query", () => {
      const nineties = match<Song>({
        genre: "rock",
        album: {
          releaseDate: {
            $gte: new Date("1990-01-01"),
            $lt: new Date("2000-01-01"),
          },
          artist: {
            verified: true,
          },
        },
      });
      expect(nineties(paranoidAndroid)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("empty query matches everything", () => {
      const matchAll = match<Song>({});
      expect(matchAll(paranoidAndroid)).toBe(true);
      expect(matchAll(sampleSongs[2])).toBe(true);
    });

    it("handles null label with $exists", () => {
      const hasLabel = match<Album>({ label: { $exists: true } });
      expect(hasLabel(okComputer)).toBe(true);

      const indie: Album = { ...okComputer, label: null };
      expect(hasLabel(indie)).toBe(false);
    });

    it("deeply nested null handling", () => {
      const fromBigLabel = match<Song>({
        album: {
          label: { $eq: "Parlophone" },
        },
      });
      expect(fromBigLabel(paranoidAndroid)).toBe(true);
      expect(fromBigLabel(sampleSongs[2])).toBe(false); // No album
    });

    it("$eq works with Date objects", () => {
      const exactDate = new Date("1997-05-21");
      const matchExactRelease = match<Album>({
        releaseDate: { $eq: exactDate },
      });
      expect(matchExactRelease(okComputer)).toBe(true);

      const wrongDate = new Date("1997-05-22");
      const matchWrongDate = match<Album>({
        releaseDate: { $eq: wrongDate },
      });
      expect(matchWrongDate(okComputer)).toBe(false);
    });

    it("$ne works with Date objects", () => {
      const otherDate = new Date("2000-01-01");
      const notThatDate = match<Album>({
        releaseDate: { $ne: otherDate },
      });
      expect(notThatDate(okComputer)).toBe(true);

      const sameDate = new Date("1997-05-21");
      const notSameDate = match<Album>({
        releaseDate: { $ne: sameDate },
      });
      expect(notSameDate(okComputer)).toBe(false);
    });

    it("implicit $eq works with Date objects", () => {
      const exactDate = new Date("1997-05-21");
      const matchExactRelease = match<Album>({
        releaseDate: exactDate,
      });
      expect(matchExactRelease(okComputer)).toBe(true);
    });
  });
});

// =============================================================================
// explain() Tests
// =============================================================================

describe("explain", () => {
  describe("successful matches", () => {
    it("returns matched: true for matching query", () => {
      const result = explain<Song>({ genre: "rock" }, paranoidAndroid);
      expect(result.matched).toBe(true);
      expect(result.failure).toBeUndefined();
    });

    it("returns matched: true for complex matching query", () => {
      const result = explain<Song>(
        {
          genre: "rock",
          plays: { $gte: 100_000_000 },
          album: {
            artist: {
              verified: true,
            },
          },
        },
        paranoidAndroid,
      );
      expect(result.matched).toBe(true);
    });

    it("returns matched: true for empty query", () => {
      const result = explain<Song>({}, paranoidAndroid);
      expect(result.matched).toBe(true);
    });
  });

  describe("simple failures", () => {
    it("explains implicit $eq failure", () => {
      const result = explain<Song>({ genre: "jazz" }, paranoidAndroid);
      expect(result.matched).toBe(false);
      expect(result.failure).toBeDefined();
      expect(result.failure?.path).toBe("genre");
      expect(result.failure?.operator).toBe("$eq (implicit)");
      expect(result.failure?.expected).toBe("jazz");
      expect(result.failure?.actual).toBe("rock");
      expect(result.failure?.message).toContain("genre");
    });

    it("explains $gte failure", () => {
      const result = explain<Song>(
        { plays: { $gte: 1_000_000_000 } },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("plays");
      expect(result.failure?.operator).toBe("$gte");
      expect(result.failure?.actual).toBe(500_000_000);
      expect(result.failure?.message).toContain(">= 1000000000");
    });

    it("explains $in failure", () => {
      const result = explain<Song>(
        { genre: { $in: ["jazz", "classical"] } },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("genre");
      expect(result.failure?.operator).toBe("$in");
      expect(result.failure?.actual).toBe("rock");
    });

    it("explains $regex failure", () => {
      const result = explain<Song>(
        { title: { $regex: /^Love/ } },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("title");
      expect(result.failure?.operator).toBe("$regex");
      expect(result.failure?.actual).toBe("Paranoid Android");
    });
  });

  describe("nested object failures", () => {
    it("explains nested field failure with full path", () => {
      const result = explain<Song>(
        {
          album: {
            artist: {
              monthlyListeners: { $gte: 100_000_000 },
            },
          },
        },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("album.artist.monthlyListeners");
      expect(result.failure?.operator).toBe("$gte");
      expect(result.failure?.actual).toBe(25_000_000);
    });

    it("explains null parent failure", () => {
      const result = explain<Song>(
        {
          album: {
            trackCount: { $gte: 1 },
          },
        },
        sampleSongs[2], // Single with no album
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("album");
      expect(result.failure?.actual).toBe(null);
    });

    it("explains deeply nested string mismatch", () => {
      const result = explain<Song>(
        {
          album: {
            artist: {
              country: "US",
            },
          },
        },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("album.artist.country");
      expect(result.failure?.expected).toBe("US");
      expect(result.failure?.actual).toBe("UK");
    });
  });

  describe("logical operator failures", () => {
    it("explains $or failure", () => {
      const result = explain<Song>(
        {
          $or: [
            { plays: { $gte: 1_000_000_000 } },
            { album: { artist: { country: "US" } } },
          ],
        },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.operator).toBe("$or");
      expect(result.failure?.message).toContain("none matched");
    });

    it("explains $not failure", () => {
      const result = explain<Song>(
        { $not: { genre: "rock" } },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.operator).toBe("$not");
      expect(result.failure?.message).toContain("NOT match");
    });

    it("explains $where failure", () => {
      const result = explain<Song>(
        { $where: (song) => song.title.includes("Love") },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.operator).toBe("$where");
    });

    it("explains $and failure with index", () => {
      const result = explain<Song>(
        {
          $and: [
            { plays: { $gte: 100_000_000 } },
            { durationMs: { $lt: 200_000 } },
          ],
        },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toContain("$and[1]");
      expect(result.failure?.path).toContain("durationMs");
    });
  });

  describe("$exists failures", () => {
    it("explains $exists: true failure", () => {
      const result = explain<Song>(
        { album: { $exists: true } },
        sampleSongs[2], // Single with no album
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("album");
      expect(result.failure?.operator).toBe("$exists");
      expect(result.failure?.expected).toBe(true);
      expect(result.failure?.actual).toBe(false);
    });

    it("explains $exists: false failure", () => {
      const result = explain<Song>(
        { album: { $exists: false } },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("album");
      expect(result.failure?.operator).toBe("$exists");
      expect(result.failure?.expected).toBe(false);
      expect(result.failure?.actual).toBe(true);
    });
  });

  describe("array operator failures", () => {
    it("explains $contains failure", () => {
      const result = explain<Artist>(
        { genres: { $contains: "country" } },
        radiohead,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("genres");
      expect(result.failure?.operator).toBe("$contains");
    });

    it("explains $size failure", () => {
      const result = explain<Artist>({ genres: { $size: 5 } }, radiohead);
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("genres");
      expect(result.failure?.operator).toBe("$size");
      expect(result.failure?.expected).toBe(5);
      expect(result.failure?.actual).toBe(3);
    });
  });

  describe("custom function failures", () => {
    it("explains $fn failure", () => {
      const result = explain<Song>(
        { durationMs: { $fn: (ms) => ms === 300_000 } },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("durationMs");
      expect(result.failure?.operator).toBe("$fn");
      expect(result.failure?.actual).toBe(386_000);
    });
  });

  describe("message formatting", () => {
    it("formats string values with quotes", () => {
      const result = explain<Song>({ genre: "jazz" }, paranoidAndroid);
      expect(result.failure?.message).toContain('"jazz"');
      expect(result.failure?.message).toContain('"rock"');
    });

    it("formats null values", () => {
      const result = explain<Song>(
        { album: { trackCount: { $gte: 1 } } },
        sampleSongs[2],
      );
      expect(result.failure?.message).toContain("null");
    });

    it("formats arrays concisely", () => {
      const result = explain<Song>(
        { genre: { $in: ["jazz", "classical", "hip-hop"] } },
        paranoidAndroid,
      );
      expect(result.failure?.message).toContain("jazz");
      expect(result.failure?.message).toContain("classical");
    });

    it("formats Date values as ISO strings", () => {
      const result = explain<Album>(
        { releaseDate: { $gte: new Date("2000-01-01") } },
        okComputer,
      );
      expect(result.failure?.message).toContain("2000-01-01");
    });
  });

  describe("first failure behavior", () => {
    it("returns first failing condition (short-circuits)", () => {
      const result = explain<Song>(
        {
          genre: "jazz", // Fails first
          plays: { $gte: 1_000_000_000 }, // Also fails
          explicit: true, // Also fails
        },
        paranoidAndroid,
      );
      expect(result.matched).toBe(false);
      // Should report genre since it's checked first (object key order)
      expect(result.failure?.path).toBe("genre");
    });
  });

  describe("matcher.explain() pattern", () => {
    it("allows match-then-explain workflow", () => {
      // Create matcher once
      const isViral = match<Song>({
        plays: { $gte: 1_000_000_000 },
        album: {
          artist: {
            verified: true,
          },
        },
      });

      // Use in filter or condition check
      if (!isViral(paranoidAndroid)) {
        // Then explain using the same matcher
        const result = isViral.explain(paranoidAndroid);

        expect(result.matched).toBe(false);
        expect(result.failure?.path).toBe("plays");
        expect(result.failure?.operator).toBe("$gte");
        expect(result.failure?.actual).toBe(500_000_000);
      }
    });

    it("matcher.explain returns matched:true for passing items", () => {
      const isRock = match<Song>({ genre: "rock" });

      expect(isRock(paranoidAndroid)).toBe(true);

      const result = isRock.explain(paranoidAndroid);
      expect(result.matched).toBe(true);
      expect(result.failure).toBeUndefined();
    });

    it("works with Array.filter then explain failures", () => {
      const isPopular = match<Song>({ plays: { $gte: 100_000_000 } });

      // Filter and get results
      const popular = sampleSongs.filter(isPopular);
      const unpopular = sampleSongs.filter((s) => !isPopular(s));

      expect(popular).toHaveLength(2);
      expect(unpopular).toHaveLength(1);

      // Explain why the unpopular one didn't match
      const result = isPopular.explain(unpopular[0]);
      expect(result.matched).toBe(false);
      expect(result.failure?.path).toBe("plays");
      expect(result.failure?.actual).toBe(50_000);
    });

    it("complex matcher with explain on nested failure", () => {
      const eligibleForPromo = match<Playlist>({
        isPublic: true,
        followerCount: { $gte: 100_000 },
        featuredSong: {
          album: {
            artist: {
              verified: true,
              monthlyListeners: { $gte: 50_000_000 },
            },
          },
        },
      });

      // First playlist is public with 150k followers and featured song
      const firstPlaylist = samplePlaylists[0];
      expect(eligibleForPromo(firstPlaylist)).toBe(false);

      // Explain why
      const result = eligibleForPromo.explain(firstPlaylist);
      expect(result.matched).toBe(false);
      // Should fail on monthlyListeners (Radiohead has 25M, needs 50M)
      expect(result.failure?.path).toBe(
        "featuredSong.album.artist.monthlyListeners",
      );
      expect(result.failure?.actual).toBe(25_000_000);
    });
  });
});
