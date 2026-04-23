import StaffSchedule from "../models/StaffSchedule.js";

export const getMyStaffSchedule = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const schedules = await StaffSchedule.find({ staff_id: userId })
      .populate("staff_id", "name staffcategory phone email")
      .sort({ date: -1 });

    res.json(schedules);
  } catch (err) {
    console.error("Error fetching my schedule:", err);
    res.status(500).json({ message: "Server error fetching schedule" });
  }
};
