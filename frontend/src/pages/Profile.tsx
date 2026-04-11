
import { useEffect, useState, ChangeEvent } from "react";
import "./Profile.css";
import { getMyProfile, updateMyProfile } from "../util/api";

type ProfileData = {
  id: number;
  name?: string;
  username?: string | null;
  email?: string;
  pronouns?: string | null;
  profile_picture?: string | null;
};

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [username, setUsername] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(
    null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getMyProfile();
        setProfile(data);
        setUsername(data.username || "");
        setPronouns(data.pronouns || "");

        const existingRaw = localStorage.getItem("user");
        if (existingRaw) {
          try {
            const existing = JSON.parse(existingRaw);
            const updatedLocal = {
              ...existing,
              username: data.username,
              pronouns: data.pronouns,
              email: data.email,
              profile_picture: data.profile_picture,
              user: existing.user
                ? {
                    ...existing.user,
                    username: data.username,
                    pronouns: data.pronouns,
                    email: data.email,
                    profile_picture: data.profile_picture,
                  }
                : undefined,
            };

            localStorage.setItem(
              "user",
              JSON.stringify(updatedLocal)
            );
          } catch {
            //
          }
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        setMessage("Failed to load profile");
      }
    };

    loadProfile();
  }, []);

  const handleImageChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    setSelectedImage(file);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setMessage("");
  };

  const handleCancel = () => {
    if (!profile) return;

    setUsername(profile.username || "");
    setPronouns(profile.pronouns || "");
    setSelectedImage(null);
    setIsEditing(false);
    setMessage("");
  };

  const handleSave = async () => {
    try {
      setMessage("");

      const result = await updateMyProfile({
        username,
        pronouns,
        profilePicture: selectedImage,
      });

      const updated = result.user;
      setProfile(updated);
      setUsername(updated.username || "");
      setPronouns(updated.pronouns || "");
      setSelectedImage(null);
      setIsEditing(false);

      const existingRaw = localStorage.getItem("user");
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw);
          const updatedLocal = {
            ...existing,
            username: updated.username,
            pronouns: updated.pronouns,
            email: updated.email,
            profile_picture: updated.profile_picture,
            user: existing.user
              ? {
                  ...existing.user,
                  username: updated.username,
                  pronouns: updated.pronouns,
                  email: updated.email,
                  profile_picture: updated.profile_picture,
                }
              : undefined,
          };

          localStorage.setItem(
            "user",
            JSON.stringify(updatedLocal)
          );
        } catch {
          //
        }
      }

      setMessage("Profile updated.");
    } catch (error) {
      console.error(error);
      setMessage("Failed to update profile");
    }
  };

  const profileImageSrc = selectedImage
    ? URL.createObjectURL(selectedImage)
    : profile?.profile_picture
    ? `http://localhost:5000/user/profile-picture/${profile.profile_picture}`
    : "https://placehold.co/200x200";

  return (
    <div className="Profile">
      <div className="profile-image">
        <img src={profileImageSrc} alt="profile" />
      </div>

      <div className="profile-info">
        {!isEditing ? (
          <>
            <h1>Full Name</h1>
            <span>{profile?.name || "No full name found"}</span>

            <h1>Username</h1>
            <span>{profile?.username || "No username set"}</span>

            <h1>Email</h1>
            <span>{profile?.email || "No email found"}</span>

            <h1>Pronouns</h1>
            <span>{profile?.pronouns || "No pronouns set"}</span>

            <button onClick={handleEdit}>Edit Profile</button>
          </>
        ) : (
          <>
            <h1>Full Name</h1>
            <span>{profile?.name || "No full name found"}</span>

            <h1>Username</h1>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <h1>Email</h1>
            <span>{profile?.email || "No email found"}</span>

            <h1>Pronouns</h1>
            <input
              type="text"
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
            />

            <h1>Profile Picture</h1>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={handleImageChange}
            />

            {selectedImage && <span>{selectedImage.name}</span>}

            <div className="profile-buttons">
              <button onClick={handleSave}>Save</button>
              <button onClick={handleCancel}>Cancel</button>
            </div>
          </>
        )}

        {message && <p>{message}</p>}
      </div>
    </div>
  );
}