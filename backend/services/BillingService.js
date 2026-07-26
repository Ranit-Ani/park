/**
 * BillingService - OOP-based centralized billing logic
 * Handles all billing calculations for the parking system
 */
class BillingService {
  constructor(hourlyRate) {
    if (!hourlyRate || hourlyRate < 0) {
      throw new Error('Invalid hourly rate provided to BillingService');
    }
    this.hourlyRate = hourlyRate;
    this.minimumHours = 1;
  }

  /**
   * Calculate total duration in milliseconds between two timestamps
   * @param {Date} checkIn
   * @param {Date} checkOut
   * @returns {number} duration in milliseconds
   */
  getDurationMs(checkIn, checkOut) {
    if (!checkIn || !checkOut) throw new Error('Both check-in and check-out times are required');
    if (checkOut < checkIn) throw new Error('Check-out time cannot be before check-in time');
    return checkOut - checkIn;
  }

  /**
   * Convert milliseconds to hours (decimal)
   * @param {number} ms
   * @returns {number}
   */
  msToHours(ms) {
    return ms / (1000 * 60 * 60);
  }

  /**
   * Round up to nearest hour, apply minimum 1-hour rule
   * @param {number} rawHours
   * @returns {number} rounded hours
   */
  roundUpHours(rawHours) {
    const rounded = Math.ceil(rawHours);
    return Math.max(rounded, this.minimumHours);
  }

  /**
   * Calculate the bill for a parking session
   * @param {Date} checkIn
   * @param {Date} checkOut
   * @returns {{ rawHours, roundedHours, totalAmount, breakdown }}
   */
  calculateBill(checkIn, checkOut) {
    const durationMs = this.getDurationMs(checkIn, checkOut);
    const rawHours = this.msToHours(durationMs);
    const roundedHours = this.roundUpHours(rawHours);
    const totalAmount = parseFloat((roundedHours * this.hourlyRate).toFixed(2));

    return {
      rawHours: parseFloat(rawHours.toFixed(4)),
      roundedHours,
      totalAmount,
      hourlyRate: this.hourlyRate,
      breakdown: {
        durationMs,
        durationMinutes: Math.floor(durationMs / 60000),
        minimumApplied: rawHours < this.minimumHours,
      },
    };
  }

  /**
   * Static factory method for easy instantiation
   * @param {number} hourlyRate
   * @returns {BillingService}
   */
  static create(hourlyRate) {
    return new BillingService(hourlyRate);
  }
}

module.exports = BillingService;
