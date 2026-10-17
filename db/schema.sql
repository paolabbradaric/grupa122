CREATE TABLE users
(
  id INT NOT NULL,
  auth_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  role VARCHAR(20) NOT NULL,
  created_at DATE NOT NULL,
  updated_at DATE NOT NULL,
  deleted_at DATE,
  PRIMARY KEY (id),
  UNIQUE (auth_id),
  UNIQUE (email)
);

CREATE TABLE candidate_profiles
(
  id INT NOT NULL,
  bio VARCHAR(5000),
  experience VARCHAR(5000),
  city VARCHAR(100),
  country VARCHAR(100),
  height_cm INT,
  video_url VARCHAR(500),
  updated_at DATE NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE organisations
(
  id INT NOT NULL,
  company_name VARCHAR(200) NOT NULL,
  reg_num VARCHAR(50) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  website VARCHAR(255),
  created_at DATE NOT NULL,
  updated_at DATE NOT NULL,
  owner_id INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  UNIQUE (reg_num)
);

CREATE TABLE projects
(
  id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  project_type VARCHAR(20) NOT NULL,
  description VARCHAR(2000),
  prod_start_date DATE,
  prod_end_date DATE,
  created_at DATE NOT NULL,
  updated_at DATE NOT NULL,
  org_id INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (org_id) REFERENCES organisations(id)
);

CREATE TABLE casting_calls
(
  id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  positions_count INT NOT NULL,
  audition_text VARCHAR(5000),
  min_age INT NOT NULL,
  max_age INT NOT NULL,
  appearance_req VARCHAR(1000),
  exp_req VARCHAR(1000),
  location VARCHAR(200) NOT NULL,
  application_deadline DATE NOT NULL,
  status VARCHAR(25) NOT NULL,
  published_at DATE,
  created_at DATE NOT NULL,
  updated_at DATE NOT NULL,
  project_id INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE applications
(
  id INT NOT NULL,
  cover_letter VARCHAR(5000),
  video_url VARCHAR(500),
  status VARCHAR(20) NOT NULL,
  rejection_reason VARCHAR(2000),
  submitted_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  candidate_id INT NOT NULL,
  casting_call_id INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(id),
  FOREIGN KEY (casting_call_id) REFERENCES casting_calls(id)
);

CREATE TABLE audition_slots
(
  id INT NOT NULL,
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  location VARCHAR(200) NOT NULL,
  capacity INT NOT NULL,
  status VARCHAR(15) NOT NULL,
  created_at DATE NOT NULL,
  casting_call_id INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (casting_call_id) REFERENCES casting_calls(id)
);

CREATE TABLE audition_bookings
(
  id INT NOT NULL,
  status VARCHAR(15) NOT NULL,
  attendance_status VARCHAR(15),
  booked_at DATE NOT NULL,
  cancelled_at DATE,
  audition_slot_id INT NOT NULL,
  application_id INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (audition_slot_id) REFERENCES audition_slots(id),
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE notifications
(
  id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message VARCHAR(2000) NOT NULL,
  is_read INT NOT NULL,
  email_sent_at DATE,
  created_at DATE NOT NULL,
  user_id INT NOT NULL,
  application_id INT NOT NULL,
  casting_call_id INT NOT NULL,
  booking_id INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (casting_call_id) REFERENCES casting_calls(id),
  FOREIGN KEY (booking_id) REFERENCES audition_bookings(id)
);

CREATE TABLE media_files
(
  id INT NOT NULL,
  kind VARCHAR(10) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  created_at DATE NOT NULL,
  owner_user_id INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE verification
(
  id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  submitted_at DATE NOT NULL,
  reviewed_at DATE,
  rejection_reason VARCHAR(2000),
  org_id INT NOT NULL,
  reviewed_by INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (org_id) REFERENCES organisations(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE TABLE skills
(
  id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  PRIMARY KEY (id),
  UNIQUE (name)
);

CREATE TABLE candidate_skills
(
  proficiency VARCHAR(20),
  candidate_id INT NOT NULL,
  skill_id INT NOT NULL,
  PRIMARY KEY (candidate_id, skill_id),
  FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(id),
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

CREATE TABLE casting_call_status_history
(
  id INT NOT NULL,
  old_status VARCHAR(25),
  new_status VARCHAR(25) NOT NULL,
  reason VARCHAR(2000),
  created_at DATE NOT NULL,
  casting_call_id INT NOT NULL,
  changed_by INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (casting_call_id) REFERENCES casting_calls(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE TABLE casting_call_skills
(
  casting_call_id INT NOT NULL,
  skill_id INT NOT NULL,
  PRIMARY KEY (casting_call_id, skill_id),
  FOREIGN KEY (casting_call_id) REFERENCES casting_calls(id),
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

CREATE TABLE application_files
(
  kind VARCHAR(10) NOT NULL,
  application_id INT NOT NULL,
  media_file_id INT NOT NULL,
  PRIMARY KEY (application_id, media_file_id),
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (media_file_id) REFERENCES media_files(id)
);

CREATE TABLE application_status_history
(
  id INT NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  reason VARCHAR(2000),
  created_at DATETIME NOT NULL,
  application_id INT NOT NULL,
  changed_by INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);