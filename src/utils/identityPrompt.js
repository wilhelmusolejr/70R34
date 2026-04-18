export function buildIdentityPrompt(profile) {
  const parts = [];

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const gender = String(profile.gender || "").toLowerCase();

  let age = "";
  if (profile.dob) {
    const birth = new Date(profile.dob);
    if (!Number.isNaN(birth.getTime())) {
      const today = new Date();
      age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    }
  }

  // Opening sentence
  let opening = fullName || "This user";
  if (age && gender) {
    opening += ` is a ${age}-year-old ${gender}`;
  } else if (age) {
    opening += ` is ${age} years old`;
  } else if (gender) {
    opening += ` is a ${gender}`;
  }
  if (profile.city) {
    opening += ` living in ${profile.city}`;
    if (profile.hometown && profile.hometown !== profile.city) {
      opening += `, originally from ${profile.hometown}`;
    }
  } else if (profile.hometown) {
    opening += ` from ${profile.hometown}`;
  }
  parts.push(`${opening}.`);

  // Bio
  if (String(profile.bio || "").trim()) {
    parts.push(`Bio: "${profile.bio.trim()}"`);
  }

  // Work
  const work = profile.work || [];
  const currentJob = work.find((w) => w.current) || work[0];
  if (currentJob?.position && currentJob?.company) {
    parts.push(`Works as ${currentJob.position} at ${currentJob.company}.`);
  } else if (currentJob?.position) {
    parts.push(`Works as ${currentJob.position}.`);
  }

  // Education
  const college = profile.education?.college;
  const hs = profile.education?.highSchool;
  const eduParts = [];
  if (college?.name) {
    const verb = college.graduated ? "graduated from" : "attended";
    const degree = college.graduated && college.degree ? ` with a ${college.degree}` : "";
    eduParts.push(`${verb} ${college.name}${degree}`);
  }
  if (hs?.name) {
    eduParts.push(`attended ${hs.name} for high school`);
  }
  if (eduParts.length) {
    parts.push(`Education: ${eduParts.join("; ")}.`);
  }

  // Personal
  if (profile.personal?.relationshipStatus) {
    parts.push(`Relationship status: ${profile.personal.relationshipStatus}.`);
  }
  const langs = profile.personal?.languages || [];
  if (langs.length) {
    parts.push(`Languages: ${langs.join(", ")}.`);
  }

  // Interests
  const interestLines = [];
  if (profile.hobbies?.length) interestLines.push(`hobbies — ${profile.hobbies.join(", ")}`);
  if (profile.interests?.music?.length) interestLines.push(`music — ${profile.interests.music.join(", ")}`);
  if (profile.interests?.movies?.length) interestLines.push(`movies — ${profile.interests.movies.join(", ")}`);
  if (profile.interests?.tvShows?.length) interestLines.push(`TV — ${profile.interests.tvShows.join(", ")}`);
  if (profile.interests?.games?.length) interestLines.push(`games — ${profile.interests.games.join(", ")}`);
  if (profile.interests?.sportsTeams?.length) interestLines.push(`sports — ${profile.interests.sportsTeams.join(", ")}`);
  if (interestLines.length) {
    parts.push(`Interests: ${interestLines.join("; ")}.`);
  }

  // Travel
  const places = (profile.travel || []).map((t) => t.place).filter(Boolean);
  if (places.length) {
    parts.push(`Has traveled to: ${places.join(", ")}.`);
  }

  return parts.join("\n");
}
