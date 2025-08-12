// controllers/addressController.js
const database = require("../../../models/database");
const Address  = require("../../../models/addresses");   // model user_addresses (đã define)
const User     = require("../../../models/user");        // nếu cần dùng sau này

// helper: map DB -> camelCase FE
const toClient = (a) => ({
  id: a.id,
  houseNumber:  a.house_number,
  wardCode:     a.ward_code,
  wardName:     a.ward_name,
  provinceCode: a.province_code,
  provinceName: a.province_name,
  fullAddress:  a.full_address,
  isDefault:    !!a.is_default,
});

// helper: validate payload tạo/sửa
const requireFields = (b) =>
  b?.houseNumber && b?.wardCode && b?.wardName && b?.provinceCode && b?.provinceName && b?.fullAddress;

/**
 * GET /api/users/me/addresses
 * hoặc: GET /api/users/:userId/addresses (nếu bạn muốn truyền id param)
 */
exports.getMyAddresses = async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: "Yêu cầu không được xác thực." });
  const userId = req.params.userId || req.user.id;

  try {
    const rows = await Address.findAll({
      where: { user_id: userId },
      order: [["is_default", "DESC"], ["id", "ASC"]],
    });
    const addresses = rows.map(toClient);
    const def = addresses.find((a) => a.isDefault) || null;

    return res.json({ addresses, defaultAddressId: def ? def.id : null });
  } catch (err) {
    console.error("getMyAddresses error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ.", error: err.message });
  }
};

/**
 * POST /api/users/:userId/addresses
 * body: { houseNumber, wardCode, wardName, provinceCode, provinceName, fullAddress, isDefault }
 */
exports.createAddress = async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: "Yêu cầu không được xác thực." });
  const userId = req.params.userId || req.user.id;

  const t = await database.transaction();
  try {
    const b = req.body || {};
    if (!requireFields(b)) {
      await t.rollback();
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc." });
    }

    if (b.isDefault === true) {
      await Address.update({ is_default: 0 }, { where: { user_id: userId }, transaction: t });
    }

    const created = await Address.create({
      user_id: userId,
      house_number:  b.houseNumber,
      ward_code:     b.wardCode,
      ward_name:     b.wardName,
      province_code: b.provinceCode,
      province_name: b.provinceName,
      full_address:  b.fullAddress,
      is_default:    b.isDefault ? 1 : 0,
    }, { transaction: t });

    await t.commit();
    return res.status(201).json(toClient(created));
  } catch (err) {
    await t.rollback();
    console.error("createAddress error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ.", error: err.message });
  }
};

/**
 * PUT /api/users/:userId/addresses/:id
 * body: các field giống create; có thể gửi một phần để cập nhật
 */
exports.updateAddress = async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: "Yêu cầu không được xác thực." });
  const userId  = req.params.userId || req.user.id;
  const addressId = req.params.id;

  const t = await database.transaction();
  try {
    const addr = await Address.findOne({ where: { id: addressId, user_id: userId }, transaction: t });
    if (!addr) { await t.rollback(); return res.status(404).json({ message: "Không tìm thấy địa chỉ." }); }

    const b = req.body || {};

    if (b.isDefault === true) {
      await Address.update({ is_default: 0 }, { where: { user_id: userId }, transaction: t });
    }

    await addr.update({
      house_number:  b.houseNumber  ?? addr.house_number,
      ward_code:     b.wardCode     ?? addr.ward_code,
      ward_name:     b.wardName     ?? addr.ward_name,
      province_code: b.provinceCode ?? addr.province_code,
      province_name: b.provinceName ?? addr.province_name,
      full_address:  b.fullAddress  ?? addr.full_address,
      is_default:    (b.isDefault === true) ? 1 : (b.isDefault === false) ? 0 : addr.is_default,
    }, { transaction: t });

    await t.commit();
    return res.json(toClient(addr));
  } catch (err) {
    await t.rollback();
    console.error("updateAddress error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ.", error: err.message });
  }
};

/**
 * DELETE /api/users/:userId/addresses/:id
 */
exports.deleteAddress = async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: "Yêu cầu không được xác thực." });
  const userId  = req.params.userId || req.user.id;
  const addressId = req.params.id;

  const t = await database.transaction();
  try {
    const addr = await Address.findOne({ where: { id: addressId, user_id: userId }, transaction: t });
    if (!addr) { await t.rollback(); return res.status(404).json({ message: "Không tìm thấy địa chỉ." }); }

    const wasDefault = Number(addr.is_default) === 1;
    await addr.destroy({ transaction: t });

    // nếu xóa địa chỉ mặc định -> đặt cái đầu tiên còn lại làm mặc định
    if (wasDefault) {
      const first = await Address.findOne({
        where: { user_id: userId },
        order: [["id", "ASC"]],
        transaction: t
      });
      if (first) {
        await Address.update({ is_default: 0 }, { where: { user_id: userId }, transaction: t });
        await first.update({ is_default: 1 }, { transaction: t });
      }
    }

    await t.commit();
    return res.sendStatus(204);
  } catch (err) {
    await t.rollback();
    console.error("deleteAddress error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ.", error: err.message });
  }
};

/**
 * PATCH /api/users/:userId/addresses/:id/default
 */
exports.setDefaultAddress = async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: "Yêu cầu không được xác thực." });
  const userId  = req.params.userId || req.user.id;
  const addressId = req.params.id;

  const t = await database.transaction();
  try {
    const addr = await Address.findOne({ where: { id: addressId, user_id: userId }, transaction: t });
    if (!addr) { await t.rollback(); return res.status(404).json({ message: "Không tìm thấy địa chỉ." }); }

    await Address.update({ is_default: 0 }, { where: { user_id: userId }, transaction: t });
    await addr.update({ is_default: 1 }, { transaction: t });

    await t.commit();
    return res.json({ message: "Đã đặt địa chỉ mặc định.", defaultAddressId: addr.id });
  } catch (err) {
    await t.rollback();
    console.error("setDefaultAddress error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ.", error: err.message });
  }
};

/**
 * PUT /api/users/:userId/addresses-bulk
 * body: { addresses: [{ id?, houseNumber, wardCode, wardName, provinceCode, provinceName, fullAddress, isDefault }], defaultAddressId? }
 */
exports.replaceAllAddresses = async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: "Yêu cầu không được xác thực." });
  const userId = req.params.userId || req.user.id;
  const { addresses = [], defaultAddressId = null } = req.body || {};

  const t = await database.transaction();
  try {
    await Address.destroy({ where: { user_id: userId }, transaction: t });

    for (const a of addresses) {
      await Address.create({
        user_id: userId,
        house_number:  a.houseNumber,
        ward_code:     a.wardCode,
        ward_name:     a.wardName,
        province_code: a.provinceCode,
        province_name: a.provinceName,
        full_address:  a.fullAddress,
        is_default:    (a.isDefault === true) || (a.id && a.id === defaultAddressId) ? 1 : 0,
      }, { transaction: t });
    }

    await t.commit();
    return res.json({ message: "Cập nhật danh sách địa chỉ thành công." });
  } catch (err) {
    await t.rollback();
    console.error("replaceAllAddresses error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ.", error: err.message });
  }
};
