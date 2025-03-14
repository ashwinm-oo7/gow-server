let forgotTemplate = function (otp) {
  return ` 
<html>
 <head>
   <style>
     body {
       background: url('path_to_tiled_background_image.jpg');
       background-repeat: repeat; 
       background-color: black;
     }
     .red-bold {
       color: red; 
       font-weight: bold;
     }
   </style>
 </head>
 <body>
 <div style="display: flex; align-items: center;">
 <div style="flex: 0 0 auto; margin-right: 20px;">
 <img src="https://i.ibb.co/M23HzTF/9-Qgzvh-Logo-Makr.png"
 alt="Maurya Logo" style="display: block; margin: 0 auto; width: 60px; height: auto;">
 </div>
 <div style="flex: 1;">

   <p class="red-bold">Do not share the OTP with anyone else.</p>
   <p>Your OTP for password reset is:<h1> ${otp} </h1></p>
   <p>Do not reply; this is auto-generated.</p>
</div>
</div>
 </body>
</html>
`;
};

let signUP = function (otp) {
  return `
    <div style="display: flex; align-items: center;">
    <div style="flex: 0 0 auto; margin-right: 20px;">
    <img src="https://i.ibb.co/M23HzTF/9-Qgzvh-Logo-Makr.png"
    title="Maurya" alt="Maurya Logo" style="display: block; margin: 0 auto; width: 40px; height: auto;">
    </div>
    <div style="flex: 1;">
    <p><strong><a href="www.Maurya" class="red-bold"  title="www.Maurya">Maurya</a></strong></p>
    <p>Your OTP for email verification is:<h1> ${otp} </h1></p>
    <p>Do not share this OTP with anyone else.</p>








    <p><a href="https://www.instagram.com/ashwin_oo7?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="><img src="https://cdn-icons-png.flaticon.com/512/3621/3621435.png" title="follow us on instagram" alt="Instagram" width="25px" height="25px"></a></p>
    <p><a href="https://www.facebook.com/ASHMI6oo7/"><img src="https://img.freepik.com/free-psd/3d-square-with-facebook-logo_125540-1565.jpg" title="follow us on facebook" alt="facebook" width="25px" height="25px"></a></p>

  </div>
  </div>
    `;
};

module.exports = {
  forgotTemplate,
  signUP,
};
