import '../app/data/constants/icons_constant.dart';

class LocalData {
//  static LoginModel? loginModel;
  static String lat = '51.1657';
  static String lon = '10.4515';

  static void setLatLon(String lat, String lon) {
    LocalData.lat = lat;
    LocalData.lon = lon;
    print('Successfully set current location lat lon...');
  }

  List<String> cityList=['Abu\n Dhabi','Dubai','Sharjah','Ajman','Al Ain','Ras AI\n Kaima','Umm AI\n Qwaine','Fujairah',];
  List<Map<String,dynamic>> cityLatLongList=[
    {  'index':0,
      'lat':24.4539,
      'lon':54.3773,
      'city':'Abu Dhabi'
    },
    {  'index':1,
      'lat':25.2048,
      'lon':55.2708,
      'city':'Dubai'
    },
    {  'index':2,
      'lat':25.3562,
      'lon':55.4272,
      'city':'Sharjah'
    },
    {  'index':3,
      'lat':25.4052,
      'lon':55.5136,
      'city':'Ajman'
    },
    {  'index':4,
      'lat':24.2232,
      'lon':55.7229,
      'city':'Al Ain'
    },
    {  'index':5,
      'lat':25.8007,
      'lon':55.9762,
      'city':'Ras AI Kaima'
    },
    {  'index':6,
      'lat':25.5508,
      'lon':55.5524,
      'city':'Umm AI Qwaine'
    },
    {  'index':7,
      'lat':25.1221,
      'lon':56.3345,
      'city':'Fujairah'
    },

  ];
  List<Map<String,String>> transportList=[
    {
      'image':IconConstants.icSmallPickUp,
      'name':'Small Pickup'
    },
    {
      'image':IconConstants.icLargePickUp,
      'name':'Large Pickup'
    },
    {
      'image':IconConstants.icMoving,
      'name':'Moving'
    },
    {
      'image':IconConstants.icGasTruck,
      'name':'Gaz Delivery'
    },

    {
      'image':IconConstants.icRecovery,
      'name':'Recovery'
    },
    {
      'image':IconConstants.icTruck,
      'name':' Truck'
    },
    {
      'image':IconConstants.icConstruction,
      'name':'Construction'
    },
    {
      'image':IconConstants.icRefrigerator,
      'name':'Refrigerator'
    },


  ];
}
