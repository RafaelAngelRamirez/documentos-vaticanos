#!/bin/bash
# Termina la ejecución del script en caso de error.

ssh-load-all-keys


set -e
clear


# GENERAL VARS
gui_path="frontend"
api_path="backend"

docker_account="legna37"



# Definir la lista de opciones requeridas
opciones=("dev" "production")

# Obtener el primer parámetro ingresado
parametro=$1

es_modo_producion=true

# Comprobar si el parámetro está en la lista de opciones requeridas
if [[ " ${opciones[@]} " =~ " ${parametro} " ]]; then
    
    echo "[ !! ] La imágen a compilar será en modo ${parametro}"
    # Solo si es modo produccion
    if [ "$parametro" == 'dev' ]; then
        es_modo_producion=false
    fi
    
    
    
else
    
    echo "[ Error ] El parámetro ingresado no es válido. Las opciones válidas son:"
    
    for opcion in "${opciones[@]}"; do
        echo "- ${opcion}"
    done
    
    exit
fi


# Obtenemos las versiones de los package
versiones=$(api_path=$api_path gui_path=$gui_path node obtener_versiones.js)
api_v=v${versiones%%|*}
gui_v=v${versiones##*\|}


reference=$docker_account/documentos-vaticanos

imagen_frontend="$reference:front-"
# imagen_backend="$reference:backend-"

imagen_frontend_latest="$reference:front-latest"
# imagen_backend_latest="$reference:backend-latest"

imagen_frontend_v=$imagen_frontend$gui_v
# imagen_backend_v=$imagen_backend$api_v


echo
echo ---------------------------------------------------
echo "[ i ] Eliminado las imagenes locales"
echo ---------------------------------------------------
echo

docker rmi -f $(docker images -a -q -f reference=$reference) || echo "[ ! ] Nada que eliminar"

echo
echo "#################################"
echo "PROCESANDO FRONT: $gui_v"
echo "#################################"
echo


echo
echo ---------------------------------------------------
echo "[ i ] COMPILANDO FRONT: $gui_v"
echo ---------------------------------------------------
echo

cd $gui_path

# if [ "$es_modo_producion" == true ]; then
#     npm run build
# else 
#     npm run build-dev
# fi

echo
echo ---------------------------------------------------
echo "[ i ] Creando nueva imagen docker $imagen_frontend_latest"
echo ---------------------------------------------------
echo

docker build --progress=plain --no-cache -t $imagen_frontend_latest .
docker tag $imagen_frontend_latest $imagen_frontend_v


# echo
# echo "#################################"
# echo "PROCESANDO BACK: $api_v"
# echo "#################################"
# echo

# echo
# echo ---------------------------------------------------
# echo "[ i ] Creando nueva imagen docker"
# echo ---------------------------------------------------
# echo

# cd ../$api_path
# npm run build
# docker build --progress=plain --no-cache -t $imagen_backend_latest .
# docker tag $imagen_backend_latest $imagen_backend_v

echo
echo ---------------------------------------------------
echo "[ i ] Subiendo imagenes"
echo ---------------------------------------------------
echo


if [ "$es_modo_producion" == true ]; then
    docker login
    docker push $imagen_frontend_latest
    docker push $imagen_frontend_v
    # docker push $imagen_backend_latest
    # docker push $imagen_backend_v
else
    
    echo "[ DEV ] En modo dev las imagenes no se cargan"
fi

echo
echo ---------------------------------------------------
echo "[ ok ] Proceso terminado"
echo ---------------------------------------------------
echo


