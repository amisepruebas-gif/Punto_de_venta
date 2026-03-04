package pop;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;


public class pop_administrador_contraseña {

    Context context;

    public void showPopupWindow(final View view, String enTurno, principal principal) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_admin_contrasena, null);


        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        context = popupView.getContext();

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);


        String pas =

        generales.loadData_sharedPreferences(context, "pasAdmin", context.getString(R.string.passAdmin));

            //principal.jsonDatos.has("pas") ||
            if(pas != ""){
               // pas = principal.jsonDatos.getString("pas");
                Button but = (Button)popupView.findViewById(R.id.but_contraseña_pop_admin);
                EditText editTextPas = (EditText)popupView.findViewById(R.id.editTextPassPopAdmin);
                String finalPas = pas;
                but.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        if (editTextPas.length() > 0){
                            if(editTextPas.getText().toString().equals(finalPas)){
                                principal.initClasAdmin();
                                popupWindow.dismiss();
                            }
                        }
                    }
                });
            }else {
                generales.toast("AUN NO HAY CONTRASEÑA ASIGNADA", context);
            }

    }
}
