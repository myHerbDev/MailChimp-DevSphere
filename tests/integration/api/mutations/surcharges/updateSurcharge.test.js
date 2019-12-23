import importAsString from "@reactioncommerce/api-utils/importAsString.js";
import Factory from "/tests/util/factory.js";
import TestApp from "/tests/util/TestApp.js";

const CreateSurchargeMutation = importAsString("./CreateSurchargeMutation.graphql");
const UpdateSurchargeMutation = importAsString("./UpdateSurchargeMutation.graphql");

jest.setTimeout(300000);

const internalShopId = "123";
const opaqueShopId = "cmVhY3Rpb24vc2hvcDoxMjM="; // reaction/shop:123
const shopName = "Test Shop";
const surchargeAttributes = [
  { property: "vendor", value: "reaction", propertyType: "string", operator: "eq" },
  { property: "productType", value: "knife", propertyType: "string", operator: "eq" }
];

const surchargeMessagesByLanguage = [
  {
    content: "You are shipping hazardous items, there is a 19.99 surcharge",
    language: "en"
  }, {
    content: "Spanish - You are shipping hazardous items, there is a 19.99 surcharge",
    language: "es"
  }
];

const surchargeDestination = { region: ["CO", "NY"] };

const mockAdminAccount = Factory.Account.makeOne({
  roles: {
    [internalShopId]: ["admin", "core"]
  }
});

let testApp;
let createSurcharge;
let updateSurcharge;
let createdSurchargeOpaqueId;

beforeAll(async () => {
  testApp = new TestApp();
  await testApp.start();
  await testApp.insertPrimaryShop({
    _id: internalShopId,
    name: shopName,
    currency: "USD",
    shopType: "merchant",
    slug: "my-shop"
  });
  await testApp.createUserAndAccount(mockAdminAccount);
  await testApp.setLoggedInUser(mockAdminAccount);

  createSurcharge = testApp.mutate(CreateSurchargeMutation);
  updateSurcharge = testApp.mutate(UpdateSurchargeMutation);

  const { createSurcharge: createdSurcharge } = await createSurcharge({
    createSurchargeInput: {
      shopId: opaqueShopId,
      surcharge: {
        amount: 19.99,
        messagesByLanguage: surchargeMessagesByLanguage,
        type: "surcharge",
        attributes: surchargeAttributes
      }
    }
  });
  createdSurchargeOpaqueId = createdSurcharge.surcharge._id;
});


afterAll(async () => {
  await testApp.collections.Surcharges.deleteMany({});
  await testApp.collections.Shops.deleteMany({});
  await testApp.collections.Accounts.deleteMany({});
  await testApp.collections.users.deleteMany({});
  await testApp.stop();
});

beforeEach(async () => {
  await testApp.clearLoggedInUser();
});

test("an authorized user can update a surcharge", async () => {
  await testApp.setLoggedInUser(mockAdminAccount);
  let result;

  try {
    result = await updateSurcharge({
      updateSurchargeInput: {
        shopId: opaqueShopId,
        surchargeId: createdSurchargeOpaqueId,
        surcharge: {
          amount: 29.99,
          messagesByLanguage: [surchargeMessagesByLanguage[0]],
          type: "surcharge",
          attributes: [surchargeAttributes[1]],
          destination: surchargeDestination
        }
      }
    });
  } catch (error) {
    expect(error).toBeUndefined();
  }

  expect(result.updateSurcharge.surcharge.shopId).toEqual(opaqueShopId);
  expect(result.updateSurcharge.surcharge.amount.amount).toEqual(29.99);
  expect(result.updateSurcharge.surcharge.messagesByLanguage).toEqual([surchargeMessagesByLanguage[0]]);
  expect(result.updateSurcharge.surcharge.attributes).toEqual([surchargeAttributes[1]]);
  expect(result.updateSurcharge.surcharge.destination).toEqual(surchargeDestination);
});


test("an unauthorized user cannot update a surcharge", async () => {
  try {
    await updateSurcharge({
      updateSurchargeInput: {
        shopId: opaqueShopId,
        surchargeId: createdSurchargeOpaqueId,
        surcharge: {
          amount: 29.99,
          messagesByLanguage: [surchargeMessagesByLanguage[0]],
          type: "surcharge",
          attributes: [surchargeAttributes[1]],
          destination: surchargeDestination
        }
      }
    });
  } catch (error) {
    expect(error).toMatchSnapshot();
  }
});