import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  Modal,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useForm, Controller } from "react-hook-form";
import * as Yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import Icon from "react-native-vector-icons/MaterialIcons";

const OrderForm = () => {
  const [openCategory, setOpenCategory] = useState(false);
  const [openItem, setOpenItem] = useState(false);
  const [items, setItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isPasswordErrorModalVisible, setIsPasswordErrorModalVisible] = useState(false);

  // New states for initial screen and admin password
  const [userType, setUserType] = useState(null); // 'counter' or 'customer'
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const beverages = {
    cold: ["Frappe", "Iced coffee", "Mocha", "Iced latte", "Cold cappuccino"],
    hot: ["Espresso", "Latte", "Cortado", "Flat white"],
    shakes: ["Oreo", "Kitkat", "Cookie nd cream", "Tiramisu", "Mocha milkshake"],
    mojito: ["Blue mint", "Lemon mint", "Strawberry", "Blueberry", "Raspberry"],
    mocktails: ["Virgin mojito", "Green lemonade", "Cucumber cooler", "Pineapple punch"],
  };

  const prices = {
    Frappe: 120,
    "Iced coffee": 110,
    Mocha: 130,
    "Iced latte": 115,
    "Cold cappuccino": 125,
    Espresso: 90,
    Latte: 100,
    Cortado: 110,
    "Flat white": 120,
    Oreo: 140,
    Kitkat: 150,
    "Cookie nd cream": 145,
    Tiramisu: 155,
    "Mocha milkshake": 160,
    "Blue mint": 130,
    "Lemon mint": 135,
    Strawberry: 140,
    Blueberry: 145,
    Raspberry: 150,
    "Virgin mojito": 120,
    "Green lemonade": 125,
    "Cucumber cooler": 130,
    "Pineapple punch": 135,
  };

  const schema = Yup.object().shape({
    name: Yup.string().matches(/^[A-Za-z\s]+$/, "Only letters allowed").required("Name is required"),
    phone: Yup.string().matches(/^[789]\d{9}$/, "Enter a valid 10-digit number starting with 7,8,9").required("Phone number is required"),
    category: Yup.string().required("Please select a category"),
    itemName: Yup.string().required("Please select an item"),
    quantity: Yup.number().typeError("Only numbers allowed").positive("Quantity must be greater than 0").required("Quantity is required"),
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema), mode: "onChange" });

  const selectedQuantity = watch("quantity");

  useEffect(() => {
    if (selectedItem && selectedQuantity) {
      let price = prices[selectedItem] || 0;
      let total = price * selectedQuantity;

      // Apply B1G1 logic for Frappe
      if (selectedItem === "Frappe" && selectedQuantity >= 2) {
        if (selectedQuantity % 2 === 0) {
          total = (price * selectedQuantity) / 2;
        } else {
          total = (price * (selectedQuantity - 1)) / 2 + price;
        }
        setModalMessage(`You have availed the B1G1 offer on Frappe!`);
        setIsModalVisible(true);
      }

      setTotalAmount(total);
    }
  }, [selectedItem, selectedQuantity]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const existingOrders = await AsyncStorage.getItem("orders");
      setOrders(existingOrders ? JSON.parse(existingOrders) : []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setItems(beverages[category]?.map((item) => ({ label: item, value: item })) || []);
    setSelectedItem(null);
    setValue("itemName", null);
  };

  const handleItemChange = (item) => {
    setSelectedItem(item);
    setValue("itemName", item);
  };

  const calculateDiscountAndPoints = (phone) => {
    const customerOrders = orders.filter((order) => order.phone === phone);
    const isReturningCustomer = customerOrders.length > 0;

    let discount = 0;
    let earnedPoints = 0;
    let totalPoints = 0;

    if (!isReturningCustomer) {
      discount = totalAmount * 0.1;
      setModalMessage(`Welcome! You got a 10% discount of ₹${discount.toFixed(2)}.`);
    } else {
      earnedPoints = totalAmount * 0.15;
      totalPoints = customerOrders.reduce((sum, order) => sum + (order.points || 0), 0) + earnedPoints;
      setModalMessage(`You earned ${earnedPoints.toFixed(2)} points! Total points: ${totalPoints.toFixed(2)}`);
    }

    if (totalPoints >= 500) {
      setModalMessage(`Congratulations! You have earned 500 points and can claim a free order up to ₹300.`);
    }

    setIsModalVisible(true);
    return { discount, earnedPoints, totalPoints };
  };

  const onSubmit = async (data) => {
    const { discount, earnedPoints, totalPoints } = calculateDiscountAndPoints(data.phone);

    const pricePerItem = prices[data.itemName] || 0;
    let finalAmount = totalAmount - discount;

    // Apply B1G1 logic for Frappe
    if (data.itemName === "Frappe" && data.quantity >= 2) {
      if (data.quantity % 2 === 0) {
        finalAmount = (pricePerItem * data.quantity) / 2 - discount;
      } else {
        finalAmount = (pricePerItem * (data.quantity - 1)) / 2 + pricePerItem - discount;
      }
    }

    const newOrder = {
      ...data,
      totalAmount: finalAmount,
      pricePerItem,
      points: earnedPoints,
      totalPoints,
      date: new Date().toISOString(),
    };

    try {
      const existingOrders = await AsyncStorage.getItem("orders");
      let orders = existingOrders ? JSON.parse(existingOrders) : [];
      orders.push(newOrder);
      await AsyncStorage.setItem("orders", JSON.stringify(orders));
      setOrders(orders);
      Alert.alert("Success", `Order Placed! Total: ₹${finalAmount.toFixed(2)}`);

      reset({
        name: "",
        phone: "",
        category: null,
        itemName: null,
        quantity: "",
      });
      setSelectedCategory(null);
      setSelectedItem(null);
      setTotalAmount(0);
    } catch (error) {
      console.error("Error saving order:", error);
      Alert.alert("Error", "Something went wrong. Try again.");
    }
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem("orders");
      setOrders([]);
      Alert.alert("Success", "Order history cleared!");
    } catch (error) {
      console.error("Error clearing history:", error);
      Alert.alert("Error", "Something went wrong. Try again.");
    }
  };

  const toggleHistoryVisibility = () => {
    setIsHistoryVisible(!isHistoryVisible);
  };

  // Handle admin password submission
  const handleAdminPasswordSubmit = () => {
    const predefinedPassword = "admin123"; // Predefined admin password
    if (adminPassword === predefinedPassword) {
      setIsAdminAuthenticated(true);
    } else {
      setIsPasswordErrorModalVisible(true); // Show password error modal
    }
  };

  // Initial screen to choose user type
  if (!userType) {
    return (
      <View style={styles.initialContainer}>
        <Text style={styles.initialHeading}>Welcome!</Text>
        <TouchableOpacity style={styles.optionButton} onPress={() => setUserType("counter")}>
          <Text style={styles.optionButtonText}>1. Counter Service</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.optionButton} onPress={() => setUserType("customer")}>
          <Text style={styles.optionButtonText}>2. Customer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Admin password screen for Counter Service
  if (userType === "counter" && !isAdminAuthenticated) {
    return (
      <View style={styles.initialContainer}>
        <Text style={styles.initialHeading}>Enter Admin Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter Password"
          secureTextEntry
          value={adminPassword}
          onChangeText={setAdminPassword}
        />
        <TouchableOpacity style={styles.optionButton} onPress={handleAdminPasswordSubmit}>
          <Text style={styles.optionButtonText}>Submit</Text>
        </TouchableOpacity>

        {/* Password Error Modal */}
        <Modal visible={isPasswordErrorModalVisible} transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalText}>Incorrect password. Please try again.</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsPasswordErrorModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Main form for Customer or authenticated Counter Service
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Order Your Beverage</Text>
        {userType === "counter" && (
          <TouchableOpacity onPress={toggleHistoryVisibility} style={styles.historyIcon}>
            <Icon name="history" size={30} color="#000" />
          </TouchableOpacity>
        )}
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <>
            <TextInput style={styles.input} placeholder="Enter Name" onChangeText={onChange} value={value} />
            {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
          </>
        )}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, value } }) => (
          <>
            <TextInput style={styles.input} placeholder="Enter Phone Number" keyboardType="numeric" onChangeText={onChange} value={value} />
            {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}
          </>
        )}
      />

      <Controller
        control={control}
        name="category"
        render={({ field: { onChange, value } }) => (
          <>
            <DropDownPicker
              open={openCategory}
              value={value}
              items={Object.keys(beverages).map((cat) => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat }))}
              setOpen={setOpenCategory}
              setValue={(callback) => {
                const newValue = callback(value);
                handleCategoryChange(newValue);
                onChange(newValue);
              }}
              placeholder="Select Category"
              style={styles.dropdown}
            />
            {errors.category && <Text style={styles.error}>{errors.category.message}</Text>}
          </>
        )}
      />

      {selectedCategory && (
        <Controller
          control={control}
          name="itemName"
          render={({ field: { onChange, value } }) => (
            <>
              <DropDownPicker
                open={openItem}
                value={value}
                items={items}
                setOpen={setOpenItem}
                setValue={(callback) => {
                  const newValue = callback(value);
                  handleItemChange(newValue);
                  onChange(newValue);
                }}
                placeholder="Select Item"
                style={styles.dropdown}
              />
              {errors.itemName && <Text style={styles.error}>{errors.itemName.message}</Text>}
            </>
          )}
        />
      )}

      <Controller
        control={control}
        name="quantity"
        render={({ field: { onChange, value } }) => (
          <>
            <TextInput style={styles.input} placeholder="Enter Quantity" keyboardType="numeric" onChangeText={onChange} value={value} />
            {errors.quantity && <Text style={styles.error}>{errors.quantity.message}</Text>}
          </>
        )}
      />

      {selectedItem && selectedQuantity ? (
        <Text style={styles.totalAmount}>Total: ₹{totalAmount}</Text>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.buttonText}>Place Order</Text>
      </TouchableOpacity>

      {isHistoryVisible && (
        <>
          <Text style={styles.orderHeading}>Previous Orders:</Text>
          <ScrollView horizontal>
            <View style={styles.table}>
              <View style={styles.tableRowHeader}>
                <Text style={styles.tableCellHeader}>Name</Text>
                <Text style={styles.tableCellHeader}>Phone No</Text>
                <Text style={styles.tableCellHeader}>Item</Text>
                <Text style={styles.tableCellHeader}>Price/Item</Text>
                <Text style={styles.tableCellHeader}>Qty</Text>
                <Text style={styles.tableCellHeader}>Total</Text>
                <Text style={styles.tableCellHeader}>Points</Text>
              </View>
              {orders.map((order, index) => (
                <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                  <Text style={styles.tableCell}>{order.name}</Text>
                  <Text style={styles.tableCell}>{order.phone}</Text>
                  <Text style={styles.tableCell}>{order.itemName}</Text>
                  <Text style={styles.tableCell}>₹{order.pricePerItem}</Text>
                  <Text style={styles.tableCell}>{order.quantity}</Text>
                  <Text style={styles.tableCell}>₹{order.totalAmount}</Text>
                  <Text style={styles.tableCell}>{order.totalPoints || 0}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.clearHistoryButton} onPress={clearHistory}>
            <Text style={styles.clearHistoryButtonText}>Clear History</Text>
          </TouchableOpacity>
        </>
      )}

      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>{modalMessage}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  initialContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  initialHeading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: "green",
    padding: 15,
    borderRadius: 5,
    marginVertical: 10,
    width: "80%",
    alignItems: "center",
  },
  optionButtonText: {
    color: "white",
    fontSize: 18,
  },
  container: { padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  heading: { fontSize: 24, fontWeight: "bold" },
  historyIcon: { padding: 10 },
  input: { borderBottomWidth: 1, marginBottom: 10, padding: 8 },
  button: { backgroundColor: "green", padding: 10, alignItems: "center", marginVertical: 10 },
  buttonText: { color: "white", fontSize: 16 },
  orderHeading: { fontSize: 18, fontWeight: "bold", marginTop: 20 },
  table: { marginTop: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 5, minWidth: 900 },
  tableRowHeader: { flexDirection: "row", backgroundColor: "#f2f2f2", padding: 10 },
  tableRow: { flexDirection: "row", padding: 10, borderBottomWidth: 1, borderColor: "#ddd" },
  evenRow: { backgroundColor: "#f9f9f9" },
  oddRow: { backgroundColor: "#ffffff" },
  tableCellHeader: { flex: 1, fontWeight: "bold", textAlign: "center", fontSize: 16, minWidth: 120 },
  tableCell: { flex: 1, textAlign: "center", fontSize: 14, padding: 5, minWidth: 120 },
  dropdown: { marginBottom: 10 },
  error: { color: "red", marginBottom: 10 },
  totalAmount: { fontSize: 18, fontWeight: "bold", marginVertical: 10, textAlign: "center" },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { backgroundColor: "white", padding: 20, borderRadius: 10, width: "60%", maxWidth: 300 },
  modalText: { fontSize: 16, marginBottom: 20, textAlign: "center" },
  modalButton: { backgroundColor: "green", padding: 10, borderRadius: 5, alignItems: "center" },
  modalButtonText: { color: "white", fontSize: 16 },
  clearHistoryButton: { alignItems: "center", marginVertical: 10 },
  clearHistoryButtonText: { color: "black", fontSize: 16, textDecorationLine: "underline" },
  
});

export default OrderForm;



// import React, { useState, useEffect } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   Alert,
//   StyleSheet,
//   ScrollView,
//   Modal,
// } from "react-native";
// import DropDownPicker from "react-native-dropdown-picker";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { useForm, Controller } from "react-hook-form";
// import * as Yup from "yup";
// import { yupResolver } from "@hookform/resolvers/yup";
// import Icon from "react-native-vector-icons/MaterialIcons";

// const OrderForm = () => {
//   const [openCategory, setOpenCategory] = useState(false);
//   const [openItem, setOpenItem] = useState(false);
//   const [items, setItems] = useState([]);
//   const [totalAmount, setTotalAmount] = useState(0);
//   const [selectedCategory, setSelectedCategory] = useState(null);
//   const [selectedItem, setSelectedItem] = useState(null);
//   const [orders, setOrders] = useState([]);
//   const [isModalVisible, setIsModalVisible] = useState(false);
//   const [modalMessage, setModalMessage] = useState("");
//   const [isHistoryVisible, setIsHistoryVisible] = useState(false);

//   // New states for initial screen and admin password
//   const [userType, setUserType] = useState(null); // 'counter' or 'customer'
//   const [adminPassword, setAdminPassword] = useState("");
//   const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

//   const beverages = {
//     cold: ["Frappe", "Iced coffee", "Mocha", "Iced latte", "Cold cappuccino"],
//     hot: ["Espresso", "Latte", "Cortado", "Flat white"],
//     shakes: ["Oreo", "Kitkat", "Cookie nd cream", "Tiramisu", "Mocha milkshake"],
//     mojito: ["Blue mint", "Lemon mint", "Strawberry", "Blueberry", "Raspberry"],
//     mocktails: ["Virgin mojito", "Green lemonade", "Cucumber cooler", "Pineapple punch"],
//   };

//   const prices = {
//     Frappe: 120,
//     "Iced coffee": 110,
//     Mocha: 130,
//     "Iced latte": 115,
//     "Cold cappuccino": 125,
//     Espresso: 90,
//     Latte: 100,
//     Cortado: 110,
//     "Flat white": 120,
//     Oreo: 140,
//     Kitkat: 150,
//     "Cookie nd cream": 145,
//     Tiramisu: 155,
//     "Mocha milkshake": 160,
//     "Blue mint": 130,
//     "Lemon mint": 135,
//     Strawberry: 140,
//     Blueberry: 145,
//     Raspberry: 150,
//     "Virgin mojito": 120,
//     "Green lemonade": 125,
//     "Cucumber cooler": 130,
//     "Pineapple punch": 135,
//   };

//   const schema = Yup.object().shape({
//     name: Yup.string().matches(/^[A-Za-z\s]+$/, "Only letters allowed").required("Name is required"),
//     phone: Yup.string().matches(/^[789]\d{9}$/, "Enter a valid 10-digit number starting with 7,8,9").required("Phone number is required"),
//     category: Yup.string().required("Please select a category"),
//     itemName: Yup.string().required("Please select an item"),
//     quantity: Yup.number().typeError("Only numbers allowed").positive("Quantity must be greater than 0").required("Quantity is required"),
//   });

//   const {
//     control,
//     handleSubmit,
//     watch,
//     setValue,
//     reset,
//     formState: { errors },
//   } = useForm({ resolver: yupResolver(schema), mode: "onChange" });

//   const selectedQuantity = watch("quantity");

//   useEffect(() => {
//     if (selectedItem && selectedQuantity) {
//       let price = prices[selectedItem] || 0;
//       let total = price * selectedQuantity;

//       // Apply B1G1 logic for Frappe
//       if (selectedItem === "Frappe" && selectedQuantity >= 2) {
//         if (selectedQuantity % 2 === 0) {
//           total = (price * selectedQuantity) / 2;
//         } else {
//           total = (price * (selectedQuantity - 1)) / 2 + price;
//         }
//         setModalMessage(`You have availed the B1G1 offer on Frappe!`);
//         setIsModalVisible(true);
//       }

//       setTotalAmount(total);
//     }
//   }, [selectedItem, selectedQuantity]);

//   useEffect(() => {
//     fetchOrders();
//   }, []);

//   const fetchOrders = async () => {
//     try {
//       const existingOrders = await AsyncStorage.getItem("orders");
//       setOrders(existingOrders ? JSON.parse(existingOrders) : []);
//     } catch (error) {
//       console.error("Error fetching orders:", error);
//     }
//   };

//   const handleCategoryChange = (category) => {
//     setSelectedCategory(category);
//     setItems(beverages[category]?.map((item) => ({ label: item, value: item })) || []);
//     setSelectedItem(null);
//     setValue("itemName", null);
//   };

//   const handleItemChange = (item) => {
//     setSelectedItem(item);
//     setValue("itemName", item);
//   };

//   const calculateDiscountAndPoints = (phone) => {
//     const customerOrders = orders.filter((order) => order.phone === phone);
//     const isReturningCustomer = customerOrders.length > 0;

//     let discount = 0;
//     let earnedPoints = 0;
//     let totalPoints = 0;

//     if (!isReturningCustomer) {
//       discount = totalAmount * 0.1;
//       setModalMessage(`Welcome! You got a 10% discount of ₹${discount.toFixed(2)}.`);
//     } else {
//       earnedPoints = totalAmount * 0.15;
//       totalPoints = customerOrders.reduce((sum, order) => sum + (order.points || 0), 0) + earnedPoints;
//       setModalMessage(`You earned ${earnedPoints.toFixed(2)} points! Total points: ${totalPoints.toFixed(2)}`);
//     }

//     if (totalPoints >= 500) {
//       setModalMessage(`Congratulations! You have earned 500 points and can claim a free order up to ₹300.`);
//     }

//     setIsModalVisible(true);
//     return { discount, earnedPoints, totalPoints };
//   };

//   const onSubmit = async (data) => {
//     const { discount, earnedPoints, totalPoints } = calculateDiscountAndPoints(data.phone);

//     const pricePerItem = prices[data.itemName] || 0;
//     let finalAmount = totalAmount - discount;

//     // Apply B1G1 logic for Frappe
//     if (data.itemName === "Frappe" && data.quantity >= 2) {
//       if (data.quantity % 2 === 0) {
//         finalAmount = (pricePerItem * data.quantity) / 2 - discount;
//       } else {
//         finalAmount = (pricePerItem * (data.quantity - 1)) / 2 + pricePerItem - discount;
//       }
//     }

//     const newOrder = {
//       ...data,
//       totalAmount: finalAmount,
//       pricePerItem,
//       points: earnedPoints,
//       totalPoints,
//       date: new Date().toISOString(),
//     };

//     try {
//       const existingOrders = await AsyncStorage.getItem("orders");
//       let orders = existingOrders ? JSON.parse(existingOrders) : [];
//       orders.push(newOrder);
//       await AsyncStorage.setItem("orders", JSON.stringify(orders));
//       setOrders(orders);
//       Alert.alert("Success", `Order Placed! Total: ₹${finalAmount.toFixed(2)}`);

//       reset({
//         name: "",
//         phone: "",
//         category: null,
//         itemName: null,
//         quantity: "",
//       });
//       setSelectedCategory(null);
//       setSelectedItem(null);
//       setTotalAmount(0);
//     } catch (error) {
//       console.error("Error saving order:", error);
//       Alert.alert("Error", "Something went wrong. Try again.");
//     }
//   };

//   const clearHistory = async () => {
//     try {
//       await AsyncStorage.removeItem("orders");
//       setOrders([]);
//       Alert.alert("Success", "Order history cleared!");
//     } catch (error) {
//       console.error("Error clearing history:", error);
//       Alert.alert("Error", "Something went wrong. Try again.");
//     }
//   };

//   const toggleHistoryVisibility = () => {
//     setIsHistoryVisible(!isHistoryVisible);
//   };

//   // Handle admin password submission
//   const handleAdminPasswordSubmit = () => {
//     const predefinedPassword = "admin123"; // Predefined admin password
//     if (adminPassword === predefinedPassword) {
//       setIsAdminAuthenticated(true);
//     } else {
//       Alert.alert("Error", "Incorrect password. Try again.");
//     }
//   };

//   // Initial screen to choose user type
//   if (!userType) {
//     return (
//       <View style={styles.initialContainer}>
//         <Text style={styles.initialHeading}>Welcome!</Text>
//         <TouchableOpacity style={styles.optionButton} onPress={() => setUserType("counter")}>
//           <Text style={styles.optionButtonText}>1. Counter Service</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.optionButton} onPress={() => setUserType("customer")}>
//           <Text style={styles.optionButtonText}>2. Customer</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   // Admin password screen for Counter Service
//   if (userType === "counter" && !isAdminAuthenticated) {
//     return (
//       <View style={styles.initialContainer}>
//         <Text style={styles.initialHeading}>Enter Admin Password</Text>
//         <TextInput
//           style={styles.input}
//           placeholder="Enter Password"
//           secureTextEntry
//           value={adminPassword}
//           onChangeText={setAdminPassword}
//         />
//         <TouchableOpacity style={styles.optionButton} onPress={handleAdminPasswordSubmit}>
//           <Text style={styles.optionButtonText}>Submit</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   // Main form for Customer or authenticated Counter Service
//   return (
//     <ScrollView style={styles.container}>
//       <View style={styles.header}>
//         <Text style={styles.heading}>Order Your Beverage</Text>
//         {userType === "counter" && (
//           <TouchableOpacity onPress={toggleHistoryVisibility} style={styles.historyIcon}>
//             <Icon name="history" size={30} color="#000" />
//           </TouchableOpacity>
//         )}
//       </View>

//       <Controller
//         control={control}
//         name="name"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <TextInput style={styles.input} placeholder="Enter Name" onChangeText={onChange} value={value} />
//             {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
//           </>
//         )}
//       />

//       <Controller
//         control={control}
//         name="phone"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <TextInput style={styles.input} placeholder="Enter Phone Number" keyboardType="numeric" onChangeText={onChange} value={value} />
//             {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}
//           </>
//         )}
//       />

//       <Controller
//         control={control}
//         name="category"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <DropDownPicker
//               open={openCategory}
//               value={value}
//               items={Object.keys(beverages).map((cat) => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat }))}
//               setOpen={setOpenCategory}
//               setValue={(callback) => {
//                 const newValue = callback(value);
//                 handleCategoryChange(newValue);
//                 onChange(newValue);
//               }}
//               placeholder="Select Category"
//               style={styles.dropdown}
//             />
//             {errors.category && <Text style={styles.error}>{errors.category.message}</Text>}
//           </>
//         )}
//       />

//       {selectedCategory && (
//         <Controller
//           control={control}
//           name="itemName"
//           render={({ field: { onChange, value } }) => (
//             <>
//               <DropDownPicker
//                 open={openItem}
//                 value={value}
//                 items={items}
//                 setOpen={setOpenItem}
//                 setValue={(callback) => {
//                   const newValue = callback(value);
//                   handleItemChange(newValue);
//                   onChange(newValue);
//                 }}
//                 placeholder="Select Item"
//                 style={styles.dropdown}
//               />
//               {errors.itemName && <Text style={styles.error}>{errors.itemName.message}</Text>}
//             </>
//           )}
//         />
//       )}

//       <Controller
//         control={control}
//         name="quantity"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <TextInput style={styles.input} placeholder="Enter Quantity" keyboardType="numeric" onChangeText={onChange} value={value} />
//             {errors.quantity && <Text style={styles.error}>{errors.quantity.message}</Text>}
//           </>
//         )}
//       />

//       {selectedItem && selectedQuantity ? (
//         <Text style={styles.totalAmount}>Total: ₹{totalAmount}</Text>
//       ) : null}

//       <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)}>
//         <Text style={styles.buttonText}>Place Order</Text>
//       </TouchableOpacity>

//       {isHistoryVisible && (
//         <>
//           <Text style={styles.orderHeading}>Previous Orders:</Text>
//           <ScrollView horizontal>
//             <View style={styles.table}>
//               <View style={styles.tableRowHeader}>
//                 <Text style={styles.tableCellHeader}>Name</Text>
//                 <Text style={styles.tableCellHeader}>Phone No</Text>
//                 <Text style={styles.tableCellHeader}>Item</Text>
//                 <Text style={styles.tableCellHeader}>Price/Item</Text>
//                 <Text style={styles.tableCellHeader}>Qty</Text>
//                 <Text style={styles.tableCellHeader}>Total</Text>
//                 <Text style={styles.tableCellHeader}>Points</Text>
//               </View>
//               {orders.map((order, index) => (
//                 <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
//                   <Text style={styles.tableCell}>{order.name}</Text>
//                   <Text style={styles.tableCell}>{order.phone}</Text>
//                   <Text style={styles.tableCell}>{order.itemName}</Text>
//                   <Text style={styles.tableCell}>₹{order.pricePerItem}</Text>
//                   <Text style={styles.tableCell}>{order.quantity}</Text>
//                   <Text style={styles.tableCell}>₹{order.totalAmount}</Text>
//                   <Text style={styles.tableCell}>{order.totalPoints || 0}</Text>
//                 </View>
//               ))}
//             </View>
//           </ScrollView>

//           <TouchableOpacity style={styles.clearHistoryButton} onPress={clearHistory}>
//             <Text style={styles.clearHistoryButtonText}>Clear History</Text>
//           </TouchableOpacity>
//         </>
//       )}

//       <Modal visible={isModalVisible} transparent={true} animationType="slide">
//         <View style={styles.modalContainer}>
//           <View style={styles.modalContent}>
//             <Text style={styles.modalText}>{modalMessage}</Text>
//             <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
//               <Text style={styles.modalButtonText}>OK</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </ScrollView>
//   );
// };

// const styles = StyleSheet.create({
//   initialContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     padding: 20,
//   },
//   initialHeading: {
//     fontSize: 24,
//     fontWeight: "bold",
//     marginBottom: 20,
//   },
//   optionButton: {
//     backgroundColor: "green",
//     padding: 15,
//     borderRadius: 5,
//     marginVertical: 10,
//     width: "80%",
//     alignItems: "center",
//   },
//   optionButtonText: {
//     color: "white",
//     fontSize: 18,
//   },
//   container: { padding: 20 },
//   header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
//   heading: { fontSize: 24, fontWeight: "bold" },
//   historyIcon: { padding: 10 },
//   input: { borderBottomWidth: 1, marginBottom: 10, padding: 8 },
//   button: { backgroundColor: "green", padding: 10, alignItems: "center", marginVertical: 10 },
//   buttonText: { color: "white", fontSize: 16 },
//   orderHeading: { fontSize: 18, fontWeight: "bold", marginTop: 20 },
//   table: { marginTop: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 5, minWidth: 900 },
//   tableRowHeader: { flexDirection: "row", backgroundColor: "#f2f2f2", padding: 10 },
//   tableRow: { flexDirection: "row", padding: 10, borderBottomWidth: 1, borderColor: "#ddd" },
//   evenRow: { backgroundColor: "#f9f9f9" },
//   oddRow: { backgroundColor: "#ffffff" },
//   tableCellHeader: { flex: 1, fontWeight: "bold", textAlign: "center", fontSize: 16, minWidth: 120 },
//   tableCell: { flex: 1, textAlign: "center", fontSize: 14, padding: 5, minWidth: 120 },
//   dropdown: { marginBottom: 10 },
//   error: { color: "red", marginBottom: 10 },
//   totalAmount: { fontSize: 18, fontWeight: "bold", marginVertical: 10, textAlign: "center" },
//   modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
//   modalContent: { backgroundColor: "white", padding: 20, borderRadius: 10, width: "60%", maxWidth: 300 },
//   modalText: { fontSize: 16, marginBottom: 20, textAlign: "center" },
//   modalButton: { backgroundColor: "green", padding: 10, borderRadius: 5, alignItems: "center" },
//   modalButtonText: { color: "white", fontSize: 16 },
//   clearHistoryButton: { alignItems: "center", marginVertical: 10 },
//   clearHistoryButtonText: { color: "black", fontSize: 16, textDecorationLine: "underline" },
  
// });

// export default OrderForm;


















// import React, { useState, useEffect } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   Alert,
//   StyleSheet,
//   ScrollView,
//   Modal,
// } from "react-native";
// import DropDownPicker from "react-native-dropdown-picker";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { useForm, Controller } from "react-hook-form";
// import * as Yup from "yup";
// import { yupResolver } from "@hookform/resolvers/yup";
// import Icon from "react-native-vector-icons/MaterialIcons";

// const OrderForm = () => {
//   const [openCategory, setOpenCategory] = useState(false);
//   const [openItem, setOpenItem] = useState(false);
//   const [items, setItems] = useState([]);
//   const [totalAmount, setTotalAmount] = useState(0);
//   const [selectedCategory, setSelectedCategory] = useState(null);
//   const [selectedItem, setSelectedItem] = useState(null);
//   const [orders, setOrders] = useState([]);
//   const [isModalVisible, setIsModalVisible] = useState(false);
//   const [modalMessage, setModalMessage] = useState("");
//   const [isHistoryVisible, setIsHistoryVisible] = useState(false);

//   // New states for initial screen and admin password
//   const [userType, setUserType] = useState(null); // 'counter' or 'customer'
//   const [adminPassword, setAdminPassword] = useState("");
//   const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

//   const beverages = {
//     cold: ["Frappe", "Iced coffee", "Mocha", "Iced latte", "Cold cappuccino"],
//     hot: ["Espresso", "Latte", "Cortado", "Flat white"],
//     shakes: ["Oreo", "Kitkat", "Cookie nd cream", "Tiramisu", "Mocha milkshake"],
//     mojito: ["Blue mint", "Lemon mint", "Strawberry", "Blueberry", "Raspberry"],
//     mocktails: ["Virgin mojito", "Green lemonade", "Cucumber cooler", "Pineapple punch"],
//   };

//   const prices = {
//     Frappe: 120,
//     "Iced coffee": 110,
//     Mocha: 130,
//     "Iced latte": 115,
//     "Cold cappuccino": 125,
//     Espresso: 90,
//     Latte: 100,
//     Cortado: 110,
//     "Flat white": 120,
//     Oreo: 140,
//     Kitkat: 150,
//     "Cookie nd cream": 145,
//     Tiramisu: 155,
//     "Mocha milkshake": 160,
//     "Blue mint": 130,
//     "Lemon mint": 135,
//     Strawberry: 140,
//     Blueberry: 145,
//     Raspberry: 150,
//     "Virgin mojito": 120,
//     "Green lemonade": 125,
//     "Cucumber cooler": 130,
//     "Pineapple punch": 135,
//   };

//   const schema = Yup.object().shape({
//     name: Yup.string().matches(/^[A-Za-z\s]+$/, "Only letters allowed").required("Name is required"),
//     phone: Yup.string().matches(/^[789]\d{9}$/, "Enter a valid 10-digit number starting with 7,8,9").required("Phone number is required"),
//     category: Yup.string().required("Please select a category"),
//     itemName: Yup.string().required("Please select an item"),
//     quantity: Yup.number().typeError("Only numbers allowed").positive("Quantity must be greater than 0").required("Quantity is required"),
//   });

//   const {
//     control,
//     handleSubmit,
//     watch,
//     setValue,
//     reset,
//     formState: { errors },
//   } = useForm({ resolver: yupResolver(schema), mode: "onChange" });

//   const selectedQuantity = watch("quantity");

//   useEffect(() => {
//     if (selectedItem && selectedQuantity) {
//       const price = prices[selectedItem] || 0;
//       setTotalAmount(price * selectedQuantity);
//     }
//   }, [selectedItem, selectedQuantity]);

//   useEffect(() => {
//     fetchOrders();
//   }, []);

//   const fetchOrders = async () => {
//     try {
//       const existingOrders = await AsyncStorage.getItem("orders");
//       setOrders(existingOrders ? JSON.parse(existingOrders) : []);
//     } catch (error) {
//       console.error("Error fetching orders:", error);
//     }
//   };

//   const handleCategoryChange = (category) => {
//     setSelectedCategory(category);
//     setItems(beverages[category]?.map((item) => ({ label: item, value: item })) || []);
//     setSelectedItem(null);
//     setValue("itemName", null);
//   };

//   const handleItemChange = (item) => {
//     setSelectedItem(item);
//     setValue("itemName", item);
//   };

//   const calculateDiscountAndPoints = (phone) => {
//     const customerOrders = orders.filter((order) => order.phone === phone);
//     const isReturningCustomer = customerOrders.length > 0;

//     let discount = 0;
//     let earnedPoints = 0;
//     let totalPoints = 0;

//     if (!isReturningCustomer) {
//       discount = totalAmount * 0.1;
//       setModalMessage(`Welcome! You got a 10% discount of ₹${discount.toFixed(2)}.`);
//     } else {
//       earnedPoints = totalAmount * 0.15;
//       totalPoints = customerOrders.reduce((sum, order) => sum + (order.points || 0), 0) + earnedPoints;
//       setModalMessage(`You earned ${earnedPoints.toFixed(2)} points! Total points: ${totalPoints.toFixed(2)}`);
//     }

//     if (totalPoints >= 500) {
//       setModalMessage(`Congratulations! You have earned 500 points and can claim a free order up to ₹300.`);
//     }

//     return { discount, earnedPoints, totalPoints };
//   };

//   const onSubmit = async (data) => {
//     const { discount, earnedPoints, totalPoints } = calculateDiscountAndPoints(data.phone);

//     const pricePerItem = prices[data.itemName] || 0;
//     let finalAmount = totalAmount - discount;

//     const newOrder = {
//       ...data,
//       totalAmount: finalAmount,
//       pricePerItem,
//       points: earnedPoints,
//       totalPoints,
//       date: new Date().toISOString(),
//     };

//     try {
//       const existingOrders = await AsyncStorage.getItem("orders");
//       let orders = existingOrders ? JSON.parse(existingOrders) : [];
//       orders.push(newOrder);
//       await AsyncStorage.setItem("orders", JSON.stringify(orders));
//       setOrders(orders);
//       Alert.alert("Success", `Order Placed! Total: ₹${finalAmount.toFixed(2)}`);

//       reset({
//         name: "",
//         phone: "",
//         category: null,
//         itemName: null,
//         quantity: "",
//       });
//       setSelectedCategory(null);
//       setSelectedItem(null);
//       setTotalAmount(0);
//     } catch (error) {
//       console.error("Error saving order:", error);
//       Alert.alert("Error", "Something went wrong. Try again.");
//     }
//   };

//   const clearHistory = async () => {
//     try {
//       await AsyncStorage.removeItem("orders");
//       setOrders([]);
//       Alert.alert("Success", "Order history cleared!");
//     } catch (error) {
//       console.error("Error clearing history:", error);
//       Alert.alert("Error", "Something went wrong. Try again.");
//     }
//   };

//   const toggleHistoryVisibility = () => {
//     setIsHistoryVisible(!isHistoryVisible);
//   };

//   // Handle admin password submission
//   const handleAdminPasswordSubmit = () => {
//     const predefinedPassword = "admin123"; // Predefined admin password
//     if (adminPassword === predefinedPassword) {
//       setIsAdminAuthenticated(true);
//     } else {
//       Alert.alert("Error", "Incorrect password. Try again.");
//     }
//   };

//   // Initial screen to choose user type
//   if (!userType) {
//     return (
//       <View style={styles.initialContainer}>
//         <Text style={styles.initialHeading}>Welcome To The Cafe!</Text>
//         <TouchableOpacity style={styles.optionButton} onPress={() => setUserType("counter")}>
//           <Text style={styles.optionButtonText}>1. Counter Service</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.optionButton} onPress={() => setUserType("customer")}>
//           <Text style={styles.optionButtonText}>2. Customer</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   // Admin password screen for Counter Service
//   if (userType === "counter" && !isAdminAuthenticated) {
//     return (
//       <View style={styles.initialContainer}>
//         <Text style={styles.initialHeading}>Enter Admin Password</Text>
//         <TextInput
//           style={styles.input}
//           placeholder="Enter Password"
//           secureTextEntry
//           value={adminPassword}
//           onChangeText={setAdminPassword}
//         />
//         <TouchableOpacity style={styles.optionButton} onPress={handleAdminPasswordSubmit}>
//           <Text style={styles.optionButtonText}>Submit</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   // Main form for Customer or authenticated Counter Service
//   return (
//     <ScrollView style={styles.container}>
//       <View style={styles.header}>
//         <Text style={styles.heading}>Order Your Beverage</Text>
//         {userType === "counter" && (
//           <TouchableOpacity onPress={toggleHistoryVisibility} style={styles.historyIcon}>
//             <Icon name="history" size={30} color="#000" />
//           </TouchableOpacity>
//         )}
//       </View>

//       <Controller
//         control={control}
//         name="name"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <TextInput style={styles.input} placeholder="Enter Name" onChangeText={onChange} value={value} />
//             {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
//           </>
//         )}
//       />

//       <Controller
//         control={control}
//         name="phone"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <TextInput style={styles.input} placeholder="Enter Phone Number" keyboardType="numeric" onChangeText={onChange} value={value} />
//             {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}
//           </>
//         )}
//       />

//       <Controller
//         control={control}
//         name="category"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <DropDownPicker
//               open={openCategory}
//               value={value}
//               items={Object.keys(beverages).map((cat) => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat }))}
//               setOpen={setOpenCategory}
//               setValue={(callback) => {
//                 const newValue = callback(value);
//                 handleCategoryChange(newValue);
//                 onChange(newValue);
//               }}
//               placeholder="Select Category"
//               style={styles.dropdown}
//             />
//             {errors.category && <Text style={styles.error}>{errors.category.message}</Text>}
//           </>
//         )}
//       />

//       {selectedCategory && (
//         <Controller
//           control={control}
//           name="itemName"
//           render={({ field: { onChange, value } }) => (
//             <>
//               <DropDownPicker
//                 open={openItem}
//                 value={value}
//                 items={items}
//                 setOpen={setOpenItem}
//                 setValue={(callback) => {
//                   const newValue = callback(value);
//                   handleItemChange(newValue);
//                   onChange(newValue);
//                 }}
//                 placeholder="Select Item"
//                 style={styles.dropdown}
//               />
//               {errors.itemName && <Text style={styles.error}>{errors.itemName.message}</Text>}
//             </>
//           )}
//         />
//       )}

//       <Controller
//         control={control}
//         name="quantity"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <TextInput style={styles.input} placeholder="Enter Quantity" keyboardType="numeric" onChangeText={onChange} value={value} />
//             {errors.quantity && <Text style={styles.error}>{errors.quantity.message}</Text>}
//           </>
//         )}
//       />

//       {selectedItem && selectedQuantity ? (
//         <Text style={styles.totalAmount}>Total: ₹{totalAmount}</Text>
//       ) : null}

//       <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)}>
//         <Text style={styles.buttonText}>Place Order</Text>
//       </TouchableOpacity>

//       {isHistoryVisible && (
//         <>
//           <Text style={styles.orderHeading}>Previous Orders:</Text>
//           <ScrollView horizontal>
//             <View style={styles.table}>
//               <View style={styles.tableRowHeader}>
//                 <Text style={styles.tableCellHeader}>Name</Text>
//                 <Text style={styles.tableCellHeader}>Phone No</Text>
//                 <Text style={styles.tableCellHeader}>Item</Text>
//                 <Text style={styles.tableCellHeader}>Price/Item</Text>
//                 <Text style={styles.tableCellHeader}>Qty</Text>
//                 <Text style={styles.tableCellHeader}>Total</Text>
//                 <Text style={styles.tableCellHeader}>Points</Text>
//               </View>
//               {orders.map((order, index) => (
//                 <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
//                   <Text style={styles.tableCell}>{order.name}</Text>
//                   <Text style={styles.tableCell}>{order.phone}</Text>
//                   <Text style={styles.tableCell}>{order.itemName}</Text>
//                   <Text style={styles.tableCell}>₹{order.pricePerItem}</Text>
//                   <Text style={styles.tableCell}>{order.quantity}</Text>
//                   <Text style={styles.tableCell}>₹{order.totalAmount}</Text>
//                   <Text style={styles.tableCell}>{order.totalPoints || 0}</Text>
//                 </View>
//               ))}
//             </View>
//           </ScrollView>

//           <TouchableOpacity style={styles.clearHistoryButton} onPress={clearHistory}>
//             <Text style={styles.clearHistoryButtonText}>Clear History</Text>
//           </TouchableOpacity>
//         </>
//       )}

//       <Modal visible={isModalVisible} transparent={true} animationType="slide">
//         <View style={styles.modalContainer}>
//           <View style={styles.modalContent}>
//             <Text style={styles.modalText}>{modalMessage}</Text>
//             <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
//               <Text style={styles.modalButtonText}>OK</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </ScrollView>
//   );
// };

// const styles = StyleSheet.create({
//   initialContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     padding: 20,
//   },
//   initialHeading: {
//     fontSize: 24,
//     fontWeight: "bold",
//     marginBottom: 20,
//   },
//   optionButton: {
//     backgroundColor: "green",
//     padding: 15,
//     borderRadius: 5,
//     marginVertical: 10,
//     width: "80%",
//     alignItems: "center",
//   },
//   optionButtonText: {
//     color: "white",
//     fontSize: 18,
//   },
//   container: { padding: 20 },
//   header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
//   heading: { fontSize: 24, fontWeight: "bold" },
//   historyIcon: { padding: 10 },
//   input: { borderBottomWidth: 1, marginBottom: 10, padding: 8 },
//   button: { backgroundColor: "green", padding: 10, alignItems: "center", marginVertical: 10 },
//   buttonText: { color: "white", fontSize: 16 },
//   orderHeading: { fontSize: 18, fontWeight: "bold", marginTop: 20 },
//   table: { marginTop: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 5, minWidth: 900 },
//   tableRowHeader: { flexDirection: "row", backgroundColor: "#f2f2f2", padding: 10 },
//   tableRow: { flexDirection: "row", padding: 10, borderBottomWidth: 1, borderColor: "#ddd" },
//   evenRow: { backgroundColor: "#f9f9f9" },
//   oddRow: { backgroundColor: "#ffffff" },
//   tableCellHeader: { flex: 1, fontWeight: "bold", textAlign: "center", fontSize: 16, minWidth: 120 },
//   tableCell: { flex: 1, textAlign: "center", fontSize: 14, padding: 5, minWidth: 120 },
//   dropdown: { marginBottom: 10 },
//   error: { color: "red", marginBottom: 10 },
//   totalAmount: { fontSize: 18, fontWeight: "bold", marginVertical: 10, textAlign: "center" },
//   modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
//   modalContent: { backgroundColor: "white", padding: 20, borderRadius: 10, width: "60%", maxWidth: 300 },
//   modalText: { fontSize: 16, marginBottom: 20, textAlign: "center" },
//   modalButton: { backgroundColor: "green", padding: 10, borderRadius: 5, alignItems: "center" },
//   modalButtonText: { color: "white", fontSize: 16 },
//   clearHistoryButton: { alignItems: "center", marginVertical: 10 },
//   clearHistoryButtonText: { color: "black", fontSize: 16, textDecorationLine: "underline" },
  
// });

// export default OrderForm;













// import React, { useState, useEffect } from "react";
// import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Modal } from "react-native";
// import DropDownPicker from "react-native-dropdown-picker";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { useForm, Controller } from "react-hook-form";
// import * as Yup from "yup";
// import { yupResolver } from "@hookform/resolvers/yup";
// import Icon from "react-native-vector-icons/MaterialIcons";

// const OrderForm = () => {
//   const [openCategory, setOpenCategory] = useState(false);
//   const [openItem, setOpenItem] = useState(false);
//   const [items, setItems] = useState([]);
//   const [totalAmount, setTotalAmount] = useState(0);
//   const [selectedCategory, setSelectedCategory] = useState(null);
//   const [selectedItem, setSelectedItem] = useState(null);
//   const [orders, setOrders] = useState([]);
//   const [isModalVisible, setIsModalVisible] = useState(false);
//   const [modalMessage, setModalMessage] = useState("");
//   const [isHistoryVisible, setIsHistoryVisible] = useState(false);

//   const beverages = {
//     cold: ["Frappe", "Iced coffee", "Mocha", "Iced latte", "Cold cappuccino"],
//     hot: ["Espresso", "Latte", "Cortado", "Flat white"],
//     shakes: ["Oreo", "Kitkat", "Cookie nd cream", "Tiramisu", "Mocha milkshake"],
//     mojito: ["Blue mint", "Lemon mint", "Strawberry", "Blueberry", "Raspberry"],
//     mocktails: ["Virgin mojito", "Green lemonade", "Cucumber cooler", "Pineapple punch"],
//   };

//   const prices = {
//     Frappe: 120,
//     "Iced coffee": 110,
//     Mocha: 130,
//     "Iced latte": 115,
//     "Cold cappuccino": 125,
//     Espresso: 90,
//     Latte: 100,
//     Cortado: 110,
//     "Flat white": 120,
//     Oreo: 140,
//     Kitkat: 150,
//     "Cookie nd cream": 145,
//     Tiramisu: 155,
//     "Mocha milkshake": 160,
//     "Blue mint": 130,
//     "Lemon mint": 135,
//     Strawberry: 140,
//     Blueberry: 145,
//     Raspberry: 150,
//     "Virgin mojito": 120,
//     "Green lemonade": 125,
//     "Cucumber cooler": 130,
//     "Pineapple punch": 135,
//   };

//   const schema = Yup.object().shape({
//     name: Yup.string().matches(/^[A-Za-z\s]+$/, "Only letters allowed").required("Name is required"),
//     phone: Yup.string().matches(/^[789]\d{9}$/, "Enter a valid 10-digit number starting with 7,8,9").required("Phone number is required"),
//     category: Yup.string().required("Please select a category"),
//     itemName: Yup.string().required("Please select an item"),
//     quantity: Yup.number().typeError("Only numbers allowed").positive("Quantity must be greater than 0").required("Quantity is required"),
//   });

//   const {
//     control,
//     handleSubmit,
//     watch,
//     setValue,
//     reset,
//     formState: { errors },
//   } = useForm({ resolver: yupResolver(schema), mode: "onChange" });

//   const selectedQuantity = watch("quantity");

//   useEffect(() => {
//     if (selectedItem && selectedQuantity) {
//       const price = prices[selectedItem] || 0;
//       setTotalAmount(price * selectedQuantity);
//     }
//   }, [selectedItem, selectedQuantity]);

//   useEffect(() => {
//     fetchOrders();
//   }, []);

//   const fetchOrders = async () => {
//     try {
//       const existingOrders = await AsyncStorage.getItem("orders");
//       setOrders(existingOrders ? JSON.parse(existingOrders) : []);
//     } catch (error) {
//       console.error("Error fetching orders:", error);
//     }
//   };

//   const handleCategoryChange = (category) => {
//     setSelectedCategory(category);
//     setItems(beverages[category]?.map((item) => ({ label: item, value: item })) || []);
//     setSelectedItem(null);
//     setValue("itemName", null);
//   };

//   const handleItemChange = (item) => {
//     setSelectedItem(item);
//     setValue("itemName", item);
//   };

//   const calculateDiscountAndPoints = (phone) => {
//     const customerOrders = orders.filter((order) => order.phone === phone);
//     const isReturningCustomer = customerOrders.length > 0;

//     let discount = 0;
//     let earnedPoints = 0;
//     let totalPoints = 0;

//     if (!isReturningCustomer) {
//       discount = totalAmount * 0.1;
//       setModalMessage(`Welcome! You got a 10% discount of ₹${discount.toFixed(2)}.`);
//     } else {
//       earnedPoints = totalAmount * 0.15;
//       totalPoints = customerOrders.reduce((sum, order) => sum + (order.points || 0), 0) + earnedPoints;
//       setModalMessage(`You earned ${earnedPoints.toFixed(2)} points! Total points: ${totalPoints.toFixed(2)}`);
//     }

//     if (totalPoints >= 500) {
//       setModalMessage(`Congratulations! You have earned 500 points and can claim a free order up to ₹300.`);
//     }

//     return { discount, earnedPoints, totalPoints };
//   };

//   const onSubmit = async (data) => {
//     let finalAmount = totalAmount;
//     let isB1G1Applied = false;

//     // Apply B1G1 offer for Frappe
//     if (data.itemName === "Frappe" && data.quantity >= 2) {
//       const pricePerFrappe = prices["Frappe"];
//       if (data.quantity % 2 === 0) {
//         finalAmount = (totalAmount / 2);
//       } else {
//         finalAmount = Math.floor(data.quantity / 2) * pricePerFrappe + pricePerFrappe;
//       }
//       isB1G1Applied = true;
//     }

//     const { discount, earnedPoints, totalPoints } = calculateDiscountAndPoints(data.phone);
//     finalAmount -= discount;

//     const newOrder = {
//       ...data,
//       totalAmount: finalAmount,
//       pricePerItem: prices[data.itemName] || 0,
//       points: earnedPoints,
//       totalPoints,
//       date: new Date().toISOString(),
//     };

//     try {
//       const existingOrders = await AsyncStorage.getItem("orders");
//       let orders = existingOrders ? JSON.parse(existingOrders) : [];
//       orders.push(newOrder);
//       await AsyncStorage.setItem("orders", JSON.stringify(orders));
//       setOrders(orders);

//       Alert.alert("Success", `Order Placed! Total: ₹${finalAmount.toFixed(2)}`);

//       if (isB1G1Applied) {
//         setModalMessage("Congratulations! You have a B1G1 offer on Frappe.");
//         setIsModalVisible(true);
//       }

//       reset({
//         name: "",
//         phone: "",
//         category: null,
//         itemName: null,
//         quantity: "",
//       });
//       setSelectedCategory(null);
//       setSelectedItem(null);
//       setTotalAmount(0);
//     } catch (error) {
//       console.error("Error saving order:", error);
//       Alert.alert("Error", "Something went wrong. Try again.");
//     }
//   };

//   const clearHistory = async () => {
//     try {
//       await AsyncStorage.removeItem("orders");
//       setOrders([]);
//       Alert.alert("Success", "Order history cleared!");
//     } catch (error) {
//       console.error("Error clearing history:", error);
//       Alert.alert("Error", "Something went wrong. Try again.");
//     }
//   };

//   const toggleHistoryVisibility = () => {
//     setIsHistoryVisible(!isHistoryVisible);
//   };

//   return (
//     <ScrollView style={styles.container}>
//       <View style={styles.header}>
//         <Text style={styles.heading}>Order Your Beverage</Text>
//         <TouchableOpacity onPress={toggleHistoryVisibility} style={styles.historyIcon}>
//           <Icon name="history" size={30} color="#000" />
//         </TouchableOpacity>
//       </View>

//       <Controller
//         control={control}
//         name="name"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <TextInput style={styles.input} placeholder="Enter Name" onChangeText={onChange} value={value} />
//             {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
//           </>
//         )}
//       />

//       <Controller
//         control={control}
//         name="phone"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <TextInput style={styles.input} placeholder="Enter Phone Number" keyboardType="numeric" onChangeText={onChange} value={value} />
//             {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}
//           </>
//         )}
//       />

//       <Controller
//         control={control}
//         name="category"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <DropDownPicker
//               open={openCategory}
//               value={value}
//               items={Object.keys(beverages).map((cat) => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat }))}
//               setOpen={setOpenCategory}
//               setValue={(callback) => {
//                 const newValue = callback(value);
//                 handleCategoryChange(newValue);
//                 onChange(newValue);
//               }}
//               placeholder="Select Category"
//               style={styles.dropdown}
//             />
//             {errors.category && <Text style={styles.error}>{errors.category.message}</Text>}
//           </>
//         )}
//       />

//       {selectedCategory && (
//         <Controller
//           control={control}
//           name="itemName"
//           render={({ field: { onChange, value } }) => (
//             <>
//               <DropDownPicker
//                 open={openItem}
//                 value={value}
//                 items={items}
//                 setOpen={setOpenItem}
//                 setValue={(callback) => {
//                   const newValue = callback(value);
//                   handleItemChange(newValue);
//                   onChange(newValue);
//                 }}
//                 placeholder="Select Item"
//                 style={styles.dropdown}
//               />
//               {errors.itemName && <Text style={styles.error}>{errors.itemName.message}</Text>}
//             </>
//           )}
//         />
//       )}

//       <Controller
//         control={control}
//         name="quantity"
//         render={({ field: { onChange, value } }) => (
//           <>
//             <TextInput style={styles.input} placeholder="Enter Quantity" keyboardType="numeric" onChangeText={onChange} value={value} />
//             {errors.quantity && <Text style={styles.error}>{errors.quantity.message}</Text>}
//           </>
//         )}
//       />

//       {selectedItem && selectedQuantity ? (
//         <Text style={styles.totalAmount}>Total: ₹{totalAmount}</Text>
//       ) : null}

//       <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)}>
//         <Text style={styles.buttonText}>Place Order</Text>
//       </TouchableOpacity>

//       {isHistoryVisible && (
//         <>
//           <Text style={styles.orderHeading}>Previous Orders:</Text>
//           <ScrollView horizontal>
//             <View style={styles.table}>
//               <View style={styles.tableRowHeader}>
//                 <Text style={styles.tableCellHeader}>Name</Text>
//                 <Text style={styles.tableCellHeader}>Phone No</Text>
//                 <Text style={styles.tableCellHeader}>Item</Text>
//                 <Text style={styles.tableCellHeader}>Price/Item</Text>
//                 <Text style={styles.tableCellHeader}>Qty</Text>
//                 <Text style={styles.tableCellHeader}>Total</Text>
//                 <Text style={styles.tableCellHeader}>Points</Text>
//               </View>
//               {orders.map((order, index) => (
//                 <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
//                   <Text style={styles.tableCell}>{order.name}</Text>
//                   <Text style={styles.tableCell}>{order.phone}</Text>
//                   <Text style={styles.tableCell}>{order.itemName}</Text>
//                   <Text style={styles.tableCell}>₹{order.pricePerItem}</Text>
//                   <Text style={styles.tableCell}>{order.quantity}</Text>
//                   <Text style={styles.tableCell}>₹{order.totalAmount}</Text>
//                   <Text style={styles.tableCell}>{order.totalPoints || 0}</Text>
//                 </View>
//               ))}
//             </View>
//           </ScrollView>

//           <TouchableOpacity style={styles.clearHistoryButton} onPress={clearHistory}>
//             <Text style={styles.clearHistoryButtonText}>Clear History</Text>
//           </TouchableOpacity>
//         </>
//       )}

//       <Modal visible={isModalVisible} transparent={true} animationType="slide">
//         <View style={styles.modalContainer}>
//           <View style={styles.modalContent}>
//             <Text style={styles.modalText}>{modalMessage}</Text>
//             <TouchableOpacity style={styles.modalButton} onPress={() => setIsModalVisible(false)}>
//               <Text style={styles.modalButtonText}>OK</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </ScrollView>
//   );
// };

// const styles = StyleSheet.create({
//   container: { padding: 20 },
//   header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
//   heading: { fontSize: 24, fontWeight: "bold" },
//   historyIcon: { padding: 10 },
//   input: { borderBottomWidth: 1, marginBottom: 10, padding: 8 },
//   button: { backgroundColor: "green", padding: 10, alignItems: "center", marginVertical: 10 },
//   buttonText: { color: "white", fontSize: 16 },
//   orderHeading: { fontSize: 18, fontWeight: "bold", marginTop: 20 },
//   table: { marginTop: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 5, minWidth: 900 },
//   tableRowHeader: { flexDirection: "row", backgroundColor: "#f2f2f2", padding: 10 },
//   tableRow: { flexDirection: "row", padding: 10, borderBottomWidth: 1, borderColor: "#ddd" },
//   evenRow: { backgroundColor: "#f9f9f9" },
//   oddRow: { backgroundColor: "#ffffff" },
//   tableCellHeader: { flex: 1, fontWeight: "bold", textAlign: "center", fontSize: 16, minWidth: 120 },
//   tableCell: { flex: 1, textAlign: "center", fontSize: 14, padding: 5, minWidth: 120 },
//   dropdown: { marginBottom: 10 },
//   error: { color: "red", marginBottom: 10 },
//   totalAmount: { fontSize: 18, fontWeight: "bold", marginVertical: 10, textAlign: "center" },
//   modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
//   modalContent: { backgroundColor: "white", padding: 20, borderRadius: 10, width: "60%", maxWidth: 300 },
//   modalText: { fontSize: 16, marginBottom: 20, textAlign: "center" },
//   modalButton: { backgroundColor: "green", padding: 10, borderRadius: 5, alignItems: "center" },
//   modalButtonText: { color: "white", fontSize: 16 },
//   clearHistoryButton: { alignItems: "center", marginVertical: 10 },
//   clearHistoryButtonText: { color: "black", fontSize: 16, textDecorationLine: "underline" },
// });

// export default OrderForm;


